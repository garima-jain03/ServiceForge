package com.serviceforge.service;

import com.serviceforge.data.MockDataStore;
import com.serviceforge.model.Job;
import com.serviceforge.model.JobStatus;
import com.serviceforge.model.Technician;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Feature 1 — Technician Availability Calendar.
 *
 * See pipeline/features/feature-1-technician-availability.md for the spec this was built against,
 * and pipeline/decisions/feature-1-decisions.md for the decisions referenced below.
 */
@Service
public class TechnicianAvailabilityService {

    /**
     * Decision (see pipeline/decisions/feature-1-decisions.md): every booked job reserves an
     * additional 45-minute travel buffer on top of its own start/end time, to account for the
     * technician getting to the next job. This is what actually limits how many jobs can be
     * scheduled for one technician in a day — anything reasoning about daily capacity needs
     * this number, not a guess.
     */
    public static final int TRAVEL_BUFFER_MINUTES = 45;

    private final MockDataStore dataStore;

    public TechnicianAvailabilityService(MockDataStore dataStore) {
        this.dataStore = dataStore;
    }

    public List<Technician> getAllTechnicians() {
        return dataStore.getAllTechnicians();
    }

    public Optional<Technician> findTechnician(Long technicianId) {
        return dataStore.findTechnician(technicianId);
    }

    public List<Job> getJobsForTechnician(Long technicianId) {
        return dataStore.getJobsForTechnician(technicianId);
    }

    /**
     * Books a new job for a technician. Rejects any booking whose interval genuinely overlaps
     * an existing one for the same technician (see rules/no-overlap-booking.md); exact-boundary
     * adjacency is allowed, and conflicts are scoped per technician.
     */
    public Job bookJob(Long technicianId, String customerName, LocalDateTime startTime, LocalDateTime endTime) {
        Technician technician = dataStore.findTechnician(technicianId)
                .orElseThrow(() -> new IllegalArgumentException("No technician with id " + technicianId));

        List<Job> existingJobs = dataStore.getJobsForTechnician(technicianId);

        // Detect genuine interval overlaps. Two intervals [aStart,aEnd) and [bStart,bEnd)
        // overlap iff aStart < bEnd && bStart < aEnd. Keep travel-buffer semantics unchanged
        // in this focused fix.
        boolean hasConflict = existingJobs.stream().anyMatch(existing -> {
            LocalDateTime existingStart = existing.getStartTime();
            LocalDateTime existingEnd = existing.getEndTime();
            return startTime.isBefore(existingEnd) && existingStart.isBefore(endTime);
        });

        if (hasConflict) {
            throw new IllegalStateException(
                    "Technician " + technician.getName() + " already has a job at " + startTime);
        }

        Job job = new Job(dataStore.nextJobId(), technicianId, customerName, startTime, endTime, JobStatus.SCHEDULED);
        return dataStore.save(job);
    }
}
