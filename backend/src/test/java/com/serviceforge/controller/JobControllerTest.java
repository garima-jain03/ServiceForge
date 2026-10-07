package com.serviceforge.controller;

import com.serviceforge.model.Job;
import com.serviceforge.model.JobStatus;
import com.serviceforge.model.PartReservation;
import com.serviceforge.service.PartsReservationService;
import com.serviceforge.service.TechnicianAvailabilityService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = JobController.class)
class JobControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TechnicianAvailabilityService availabilityService;

    @MockBean
    private PartsReservationService reservationService;

    // AC5 — a job with no reservations returns an empty list, not an error.
    @Test
    void getReservations_returnsEmptyListForJobWithNone() throws Exception {
        given(reservationService.listForJob(5L)).willReturn(List.of());

        mockMvc.perform(get("/api/jobs/5/reservations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void getReservations_returnsActiveReservationsForJob() throws Exception {
        given(reservationService.listForJob(1L)).willReturn(List.of(new PartReservation(1L, "FLT-16", 1L, 2)));

        mockMvc.perform(get("/api/jobs/1/reservations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].sku").value("FLT-16"))
                .andExpect(jsonPath("$[0].quantity").value(2));
    }

    // AC8/E2 — cancelling a job must auto-release its reservations in the same operation.
    @Test
    void cancelJob_releasesAllReservationsForThatJob() throws Exception {
        Job cancelled = new Job(1L, 1L, "Acme Corp", LocalDateTime.now(), LocalDateTime.now().plusHours(1), JobStatus.CANCELLED);
        given(availabilityService.cancelJob(1L)).willReturn(cancelled);

        mockMvc.perform(post("/api/jobs/1/cancel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        verify(reservationService).releaseAllForJob(1L);
    }

    @Test
    void cancelJob_returns404ForUnknownJob() throws Exception {
        willThrow(new IllegalArgumentException("No job with id 999")).given(availabilityService).cancelJob(999L);

        mockMvc.perform(post("/api/jobs/999/cancel"))
                .andExpect(status().isNotFound());
    }
}
