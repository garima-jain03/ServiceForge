package com.serviceforge.controller;

import com.serviceforge.dto.ApiError;
import com.serviceforge.dto.BookJobRequest;
import com.serviceforge.model.Job;
import com.serviceforge.service.PartsReservationService;
import com.serviceforge.service.TechnicianAvailabilityService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/jobs")
public class JobController {

    private final TechnicianAvailabilityService availabilityService;
    private final PartsReservationService reservationService;

    public JobController(TechnicianAvailabilityService availabilityService, PartsReservationService reservationService) {
        this.availabilityService = availabilityService;
        this.reservationService = reservationService;
    }

    @PostMapping
    public ResponseEntity<?> bookJob(@Valid @RequestBody BookJobRequest request) {
        try {
            Job job = availabilityService.bookJob(
                    request.getTechnicianId(),
                    request.getCustomerName(),
                    request.getStartTime(),
                    request.getEndTime());
            return ResponseEntity.status(201).body(job);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(new ApiError(e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(new ApiError(e.getMessage()));
        }
    }

    @GetMapping("/{jobId}/reservations")
    public ResponseEntity<?> getReservations(@PathVariable Long jobId) {
        return ResponseEntity.ok(reservationService.listForJob(jobId));
    }

    @PostMapping("/{jobId}/cancel")
    public ResponseEntity<?> cancelJob(@PathVariable Long jobId) {
        try {
            Job job = availabilityService.cancelJob(jobId);
            reservationService.releaseAllForJob(jobId);
            return ResponseEntity.ok(job);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(new ApiError(e.getMessage()));
        }
    }
}
