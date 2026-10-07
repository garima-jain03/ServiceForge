package com.serviceforge.service;

import com.serviceforge.data.MockDataStore;
import com.serviceforge.model.Job;
import com.serviceforge.model.JobStatus;
import com.serviceforge.model.PartReservation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Covers Feature 2's Acceptance Criteria (pipeline/features/feature-2-parts-reservation.md)
 * against the real MockDataStore + TechnicianAvailabilityService collaborators (no mocks),
 * exercising the full schedule -> reserve -> list -> release / cancel flow in-process.
 */
class PartsReservationServiceTest {

    private MockDataStore dataStore;
    private TechnicianAvailabilityService availabilityService;
    private PartsReservationService reservationService;

    @BeforeEach
    void setUp() {
        dataStore = new MockDataStore();
        dataStore.seed();
        availabilityService = new TechnicianAvailabilityService(dataStore);
        reservationService = new PartsReservationService(dataStore, availabilityService);
    }

    // AC1 — valid, SCHEDULED, non-overlapping job + sufficient stock -> reservation created.
    @Test
    void reserve_succeedsForValidScheduledJobWithSufficientStock() {
        PartReservation reservation = reservationService.reserve("FLT-16", 1L, 2);

        assertEquals("FLT-16", reservation.getSku());
        assertEquals(1L, reservation.getJobId());
        assertEquals(2, reservation.getQuantity());
        assertEquals(23, dataStore.findPart("FLT-16").orElseThrow().getQuantityOnHand());
    }

    // AC2 — unknown job id -> no reservation created.
    @Test
    void reserve_throwsForUnknownJob() {
        assertThrows(IllegalArgumentException.class, () -> reservationService.reserve("FLT-16", 999L, 1));
    }

    // AC3/E4 — a cancelled job is no longer a valid reservation target, even if it once was.
    @Test
    void reserve_throwsWhenJobIsCancelled() {
        availabilityService.cancelJob(1L);

        assertThrows(IllegalStateException.class, () -> reservationService.reserve("FLT-16", 1L, 1));
    }

    // AC3/E4 — live re-check, not a cached result: simulate a booking introduced outside the
    // normal bookJob() validation path so two jobs for the same technician now overlap.
    @Test
    void reserve_throwsWhenJobSlotOverlapsAnotherBookingForSameTechnician() {
        LocalDateTime start = LocalDateTime.now().withHour(9).withMinute(30).withSecond(0).withNano(0);
        LocalDateTime end = start.plusHours(1);
        Job conflicting = dataStore.save(new Job(dataStore.nextJobId(), 1L, "Conflicting Customer", start, end, JobStatus.SCHEDULED));

        assertThrows(IllegalStateException.class, () -> reservationService.reserve("FLT-16", conflicting.getId(), 1));
    }

    // AC4/E3 — requested quantity exceeds stock-on-hand -> reject whole request, reserve nothing.
    @Test
    void reserve_throwsWhenQuantityExceedsStock() {
        assertThrows(IllegalStateException.class, () -> reservationService.reserve("CMP-CLUTCH", 1L, 5));
        assertEquals(1, dataStore.findPart("CMP-CLUTCH").orElseThrow().getQuantityOnHand());
    }

    // AC5 — a job with no reservations returns an empty list, not an error.
    @Test
    void listForJob_returnsEmptyListWhenNoReservations() {
        assertTrue(reservationService.listForJob(1L).isEmpty());
    }

    // AC5 — only active reservations linked to that specific job are returned.
    @Test
    void listForJob_returnsActiveReservationsForThatJobOnly() {
        reservationService.reserve("FLT-16", 1L, 1);
        reservationService.reserve("THRM-STAT", 3L, 1);

        assertEquals(1, reservationService.listForJob(1L).size());
    }

    // AC6 — releasing a reservation removes it from the job's list and restores stock.
    @Test
    void release_restoresStockAndRemovesFromJobsList() {
        PartReservation reservation = reservationService.reserve("CMP-CLUTCH", 1L, 1);
        assertEquals(0, dataStore.findPart("CMP-CLUTCH").orElseThrow().getQuantityOnHand());

        reservationService.release(reservation.getId());

        assertEquals(1, dataStore.findPart("CMP-CLUTCH").orElseThrow().getQuantityOnHand());
        assertTrue(reservationService.listForJob(1L).isEmpty());
    }

    // AC7 — releasing an unknown reservation id is a 404-equivalent failure.
    @Test
    void release_throwsForUnknownReservation() {
        assertThrows(IllegalArgumentException.class, () -> reservationService.release(12345L));
    }

    // AC7 — releasing an already-released reservation is also a 404-equivalent failure.
    @Test
    void release_throwsWhenAlreadyReleased() {
        PartReservation reservation = reservationService.reserve("CMP-CLUTCH", 1L, 1);
        reservationService.release(reservation.getId());

        assertThrows(IllegalArgumentException.class, () -> reservationService.release(reservation.getId()));
    }

    // AC8/E2/SM-3 — cancelling a job releases every reservation tied to it and restores stock.
    @Test
    void cancellingAJob_releasesAllItsReservationsAndRestoresStock() {
        reservationService.reserve("CMP-CLUTCH", 1L, 1);
        assertEquals(0, dataStore.findPart("CMP-CLUTCH").orElseThrow().getQuantityOnHand());

        availabilityService.cancelJob(1L);
        reservationService.releaseAllForJob(1L);

        assertTrue(reservationService.listForJob(1L).isEmpty());
        assertEquals(1, dataStore.findPart("CMP-CLUTCH").orElseThrow().getQuantityOnHand());
    }

    // Correctness — reservation logic must not itself enforce Feature 1's 45-minute travel
    // buffer: a reservation against a job starting the instant an adjacent one ends must succeed.
    @Test
    void reserve_succeedsForBackToBackJobsRegardlessOfTravelBuffer() {
        LocalDateTime start = LocalDateTime.now().withHour(11).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime end = start.plusHours(1);
        Job adjacentJob = availabilityService.bookJob(1L, "Adjacent Customer", start, end);

        PartReservation firstReservation = reservationService.reserve("FLT-16", 1L, 1);
        PartReservation secondReservation = reservationService.reserve("FLT-16", adjacentJob.getId(), 1);

        assertNotNull(firstReservation);
        assertNotNull(secondReservation);
    }
}
