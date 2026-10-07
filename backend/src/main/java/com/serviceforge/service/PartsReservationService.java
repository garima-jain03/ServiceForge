package com.serviceforge.service;

import com.serviceforge.data.MockDataStore;
import com.serviceforge.model.PartReservation;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Feature 2 — Parts Reservation business logic (see pipeline/architecture-adr.md).
 *
 * Re-checks Feature 1's live job validity on every reservation rather than trusting a cached
 * result (spec D1/E4), and delegates the atomic stock check-and-decrement to MockDataStore.
 */
@Service
public class PartsReservationService {

    private final MockDataStore dataStore;
    private final TechnicianAvailabilityService availabilityService;

    public PartsReservationService(MockDataStore dataStore, TechnicianAvailabilityService availabilityService) {
        this.dataStore = dataStore;
        this.availabilityService = availabilityService;
    }

    public PartReservation reserve(String sku, Long jobId, int quantity) {
        if (dataStore.findJob(jobId).isEmpty()) {
            throw new IllegalArgumentException("unknown jobId '" + jobId + "'");
        }
        if (!availabilityService.isValidNonOverlapping(jobId)) {
            throw new IllegalStateException("job " + jobId + " does not hold a valid, non-overlapping slot");
        }
        return dataStore.reservePart(sku, jobId, quantity);
    }

    public List<PartReservation> listForJob(Long jobId) {
        return dataStore.getReservationsForJob(jobId);
    }

    public void release(Long reservationId) {
        if (!dataStore.releaseReservation(reservationId)) {
            throw new IllegalArgumentException("unknown or already-released reservation id " + reservationId);
        }
    }

    public void releaseAllForJob(Long jobId) {
        dataStore.releaseAllForJob(jobId);
    }
}
