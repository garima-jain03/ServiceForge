package com.serviceforge.model;

public class PartReservation {

    public enum Status {
        ACTIVE,
        RELEASED
    }

    private final Long id;
    private final String sku;
    private final Long jobId;
    private final int quantity;
    private Status status;

    public PartReservation(Long id, String sku, Long jobId, int quantity) {
        this.id = id;
        this.sku = sku;
        this.jobId = jobId;
        this.quantity = quantity;
        this.status = Status.ACTIVE;
    }

    public Long getId() {
        return id;
    }

    public String getSku() {
        return sku;
    }

    public Long getJobId() {
        return jobId;
    }

    public int getQuantity() {
        return quantity;
    }

    public Status getStatus() {
        return status;
    }

    public void release() {
        this.status = Status.RELEASED;
    }
}
