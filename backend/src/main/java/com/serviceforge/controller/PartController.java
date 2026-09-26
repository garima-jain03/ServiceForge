package com.serviceforge.controller;

import com.serviceforge.data.MockDataStore;
import com.serviceforge.dto.ApiError;
import com.serviceforge.dto.ReservePartRequest;
import com.serviceforge.model.PartReservation;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/parts")
public class PartController {

    private final MockDataStore dataStore;

    public PartController(MockDataStore dataStore) {
        this.dataStore = dataStore;
    }

    @PostMapping("/{sku}/reservations")
    public ResponseEntity<?> reservePart(@PathVariable String sku, @Valid @RequestBody ReservePartRequest request) {
        if (dataStore.findJob(request.getJobId()).isEmpty()) {
            return ResponseEntity.status(404).body(new ApiError("unknown jobId '" + request.getJobId() + "'"));
        }
        try {
            PartReservation reservation = dataStore.reservePart(sku, request.getJobId(), request.getQuantity());
            return ResponseEntity.status(201).body(reservation);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(new ApiError(e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(new ApiError(e.getMessage()));
        }
    }
}
