package com.serviceforge.data;

import com.serviceforge.model.Job;
import com.serviceforge.model.JobStatus;
import com.serviceforge.model.Part;
import com.serviceforge.model.PartReservation;
import com.serviceforge.model.Technician;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

/**
 * In-memory mock data store. There is no real database in this repo (see AGENTS.md) —
 * everything here resets on restart, which is expected for a training boilerplate.
 */
@Component
public class MockDataStore {

    private final List<Technician> technicians = new ArrayList<>();
    private final List<Job> jobs = new ArrayList<>();
    private final List<Part> parts = new ArrayList<>();
    private final List<PartReservation> partReservations = new ArrayList<>();
    private final AtomicLong jobIdSequence = new AtomicLong(1);
    private final AtomicLong reservationIdSequence = new AtomicLong(1);

    @PostConstruct
    public void seed() {
        technicians.add(new Technician(1L, "Jordan Reyes", "North"));
        technicians.add(new Technician(2L, "Priya Nair", "South"));
        technicians.add(new Technician(3L, "Sam Okafor", "East"));

        // Seed a couple of non-overlapping jobs so the calendar isn't empty on first run.
        jobs.add(new Job(nextJobId(), 1L, "Acme Corp",
                LocalDateTime.now().withHour(9).withMinute(0).withSecond(0).withNano(0),
                LocalDateTime.now().withHour(11).withMinute(0).withSecond(0).withNano(0),
                JobStatus.SCHEDULED));
        jobs.add(new Job(nextJobId(), 1L, "Northwind Traders",
                LocalDateTime.now().withHour(14).withMinute(0).withSecond(0).withNano(0),
                LocalDateTime.now().withHour(15).withMinute(30).withSecond(0).withNano(0),
                JobStatus.SCHEDULED));
        jobs.add(new Job(nextJobId(), 2L, "Globex", LocalDateTime.now().withHour(10).withMinute(0).withSecond(0).withNano(0),
                LocalDateTime.now().withHour(12).withMinute(0).withSecond(0).withNano(0),
                JobStatus.SCHEDULED));

        // Seed a small HVAC parts catalogue — CMP-CLUTCH is intentionally scarce (Feature 2 prep).
        parts.add(new Part("CMP-CLUTCH", "Compressor Clutch", 1));
        parts.add(new Part("FLT-16", "16x20 Air Filter", 25));
        parts.add(new Part("THRM-STAT", "Programmable Thermostat", 8));
    }

    public List<Technician> getAllTechnicians() {
        return Collections.unmodifiableList(technicians);
    }

    public Optional<Technician> findTechnician(Long id) {
        return technicians.stream().filter(t -> t.getId().equals(id)).findFirst();
    }

    public List<Job> getJobsForTechnician(Long technicianId) {
        return jobs.stream()
                .filter(j -> j.getTechnicianId().equals(technicianId))
                .collect(Collectors.toList());
    }

    public List<Job> getAllJobs() {
        return Collections.unmodifiableList(jobs);
    }

    public Job save(Job job) {
        jobs.add(job);
        return job;
    }

    public Long nextJobId() {
        return jobIdSequence.getAndIncrement();
    }

    public List<Part> getAllParts() {
        return Collections.unmodifiableList(parts);
    }

    public Optional<Part> findPart(String sku) {
        return parts.stream().filter(p -> p.getSku().equals(sku)).findFirst();
    }

    public Optional<Job> findJob(Long jobId) {
        return jobs.stream().filter(j -> j.getId().equals(jobId)).findFirst();
    }

    /**
     * Atomically checks and decrements stock so two concurrent reservation requests can never
     * both succeed against the same last unit (mirrors Feature 1's overlap-check-must-be-atomic lesson).
     */
    public synchronized PartReservation reservePart(String sku, Long jobId, int quantity) {
        Part part = findPart(sku).orElseThrow(() -> new IllegalArgumentException("unknown sku '" + sku + "'"));
        if (part.getQuantityOnHand() < quantity) {
            throw new IllegalStateException(
                    "insufficient stock for " + sku + ": requested " + quantity + ", on hand " + part.getQuantityOnHand());
        }
        part.setQuantityOnHand(part.getQuantityOnHand() - quantity);
        PartReservation reservation = new PartReservation(reservationIdSequence.getAndIncrement(), sku, jobId, quantity);
        partReservations.add(reservation);
        return reservation;
    }

    public Optional<PartReservation> findReservation(Long reservationId) {
        return partReservations.stream().filter(r -> r.getId().equals(reservationId)).findFirst();
    }

    public List<PartReservation> getReservationsForJob(Long jobId) {
        return partReservations.stream()
                .filter(r -> r.getJobId().equals(jobId) && r.getStatus() == PartReservation.Status.ACTIVE)
                .collect(Collectors.toList());
    }

    /**
     * Restores the released quantity to on-hand stock in the same critical section as the
     * status flip, mirroring reservePart's atomic check-then-mutate pattern.
     */
    public synchronized boolean releaseReservation(Long reservationId) {
        Optional<PartReservation> found = findReservation(reservationId);
        if (found.isEmpty() || found.get().getStatus() == PartReservation.Status.RELEASED) {
            return false;
        }
        PartReservation reservation = found.get();
        reservation.release();
        findPart(reservation.getSku()).ifPresent(part -> part.setQuantityOnHand(part.getQuantityOnHand() + reservation.getQuantity()));
        return true;
    }

    public synchronized void releaseAllForJob(Long jobId) {
        partReservations.stream()
                .filter(r -> r.getJobId().equals(jobId) && r.getStatus() == PartReservation.Status.ACTIVE)
                .forEach(r -> releaseReservation(r.getId()));
    }
}
