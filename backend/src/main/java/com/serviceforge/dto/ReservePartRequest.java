package com.serviceforge.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class ReservePartRequest {

    @NotNull
    private Long jobId;

    @Min(1)
    private int quantity;

    // Optional free-text field; never persisted, only screened by PromptInjectionGuard (RULE job-notes-injection-guardrail).
    private String notes;

    public Long getJobId() {
        return jobId;
    }

    public void setJobId(Long jobId) {
        this.jobId = jobId;
    }

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}
