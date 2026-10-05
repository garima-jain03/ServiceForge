package com.serviceforge.service;

import com.serviceforge.data.MockDataStore;
import com.serviceforge.model.Job;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Covers Feature 1's interval-overlap conflict rule (see pipeline/rules/no-overlap-booking.md and
 * pipeline/decisions/feature-1-decisions.md): exact-start conflicts, genuine interval overlaps,
 * containment in both directions, exact-boundary adjacency (allowed), and per-technician
 * isolation (an identical window is fine for a different technician).
 */
class TechnicianAvailabilityServiceTest {

    private MockDataStore dataStore;
    private TechnicianAvailabilityService service;

    @BeforeEach
    void setUp() {
        dataStore = new MockDataStore();
        dataStore.seed();
        service = new TechnicianAvailabilityService(dataStore);
    }

    @Test
    void booksAJobForAnAvailableTechnician() {
        LocalDateTime start = LocalDateTime.now().withHour(16).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime end = start.plusHours(1);

        Job job = service.bookJob(1L, "New Customer", start, end);

        assertEquals("New Customer", job.getCustomerName());
        assertEquals(1L, job.getTechnicianId());
    }

    @Test
    void rejectsABookingAtAnIdenticalStartTimeAsAnExistingJob() {
        LocalDateTime start = LocalDateTime.now().withHour(9).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime end = start.plusHours(1);
        // Technician 1 already has a seeded job starting at 09:00 (see MockDataStore.seed()).

        assertThrows(IllegalStateException.class, () -> service.bookJob(1L, "Conflicting Customer", start, end));
    }
    @Test
    void rejectsABookingThatStartsDuringAnExistingJob() {
        // Seeded job for technician 1 is 09:00-11:00; a booking starting at 10:00 must be rejected.
        LocalDateTime start = LocalDateTime.now().withHour(10).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime end = start.plusHours(1);

        assertThrows(IllegalStateException.class, () -> service.bookJob(1L, "Overlapping Customer", start, end));
    }

    @Test
    void throwsForAnUnknownTechnician() {
        LocalDateTime start = LocalDateTime.now().plusDays(1);
        LocalDateTime end = start.plusHours(1);

        assertThrows(IllegalArgumentException.class, () -> service.bookJob(999L, "Nobody", start, end));
    }

    @Test
    void rejectsABookingThatFullyContainsAnExistingJob() {
        // Seeded job for technician 1 is 09:00-11:00; a booking spanning 08:30-11:30 fully contains it.
        LocalDateTime start = LocalDateTime.now().withHour(8).withMinute(30).withSecond(0).withNano(0);
        LocalDateTime end = LocalDateTime.now().withHour(11).withMinute(30).withSecond(0).withNano(0);

        assertThrows(IllegalStateException.class, () -> service.bookJob(1L, "Containing Customer", start, end));
    }

    @Test
    void rejectsABookingThatIsFullyContainedWithinAnExistingJob() {
        // Seeded job for technician 1 is 09:00-11:00; a booking of 09:30-10:30 sits entirely inside it.
        LocalDateTime start = LocalDateTime.now().withHour(9).withMinute(30).withSecond(0).withNano(0);
        LocalDateTime end = LocalDateTime.now().withHour(10).withMinute(30).withSecond(0).withNano(0);

        assertThrows(IllegalStateException.class, () -> service.bookJob(1L, "Contained Customer", start, end));
    }

    @Test
    void allowsABookingThatEndsExactlyWhenAnExistingJobStarts() {
        // Seeded job for technician 1 starts at 09:00; a booking ending exactly at 09:00 is adjacent, not overlapping.
        LocalDateTime start = LocalDateTime.now().withHour(7).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime end = LocalDateTime.now().withHour(9).withMinute(0).withSecond(0).withNano(0);

        Job job = service.bookJob(1L, "Adjacent Before Customer", start, end);

        assertEquals("Adjacent Before Customer", job.getCustomerName());
    }

    @Test
    void allowsABookingThatStartsExactlyWhenAnExistingJobEnds() {
        // Seeded job for technician 1 ends at 11:00; a booking starting exactly at 11:00 is adjacent, not overlapping.
        LocalDateTime start = LocalDateTime.now().withHour(11).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime end = LocalDateTime.now().withHour(12).withMinute(0).withSecond(0).withNano(0);

        Job job = service.bookJob(1L, "Adjacent After Customer", start, end);

        assertEquals("Adjacent After Customer", job.getCustomerName());
    }

    @Test
    void allowsOverlappingTimesForDifferentTechnicians() {
        // Technician 1 has a seeded job 09:00-11:00; technician 3 has no seeded jobs, so the
        // identical window must be allowed since conflicts are scoped per technician.
        LocalDateTime start = LocalDateTime.now().withHour(9).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime end = LocalDateTime.now().withHour(11).withMinute(0).withSecond(0).withNano(0);

        Job job = service.bookJob(3L, "Different Technician Customer", start, end);

        assertEquals(3L, job.getTechnicianId());
    }
}
