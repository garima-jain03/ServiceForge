package com.serviceforge.controller;

import com.serviceforge.data.MockDataStore;
import com.serviceforge.dto.ApiError;
import com.serviceforge.dto.ReservePartRequest;
import com.serviceforge.model.PartReservation;
import com.serviceforge.service.PartsReservationService;
import com.serviceforge.util.PromptInjectionGuard;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/parts")
public class PartController {

    private final MockDataStore dataStore;
    private final PartsReservationService reservationService;

    public PartController(MockDataStore dataStore, PartsReservationService reservationService) {
        this.dataStore = dataStore;
        this.reservationService = reservationService;
    }

    @PostMapping("/{sku}/reservations")
    public ResponseEntity<?> reservePart(@PathVariable String sku, @Valid @RequestBody ReservePartRequest request) {
        if (PromptInjectionGuard.isSuspicious(request.getNotes())) {
            return ResponseEntity.status(400).body(new ApiError("notes field rejected by guardrail: possible prompt injection"));
        }
        try {
            PartReservation reservation = reservationService.reserve(sku, request.getJobId(), request.getQuantity());
            return ResponseEntity.status(201).body(reservation);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(new ApiError(e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(new ApiError(e.getMessage()));
        }
    }

    @DeleteMapping("/reservations/{reservationId}")
    public ResponseEntity<?> releaseReservation(@PathVariable Long reservationId) {
        try {
            reservationService.release(reservationId);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(new ApiError(e.getMessage()));
        }
    }

    @GetMapping("/{sku}")
    public ResponseEntity<?> getPart(@PathVariable String sku) {
        return dataStore.findPart(sku)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(404).body(new ApiError("unknown sku '" + sku + "'")));
    }
}
