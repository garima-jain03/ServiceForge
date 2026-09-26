package com.serviceforge.model;

public class Part {

    private final String sku;
    private final String name;
    private int quantityOnHand;

    public Part(String sku, String name, int quantityOnHand) {
        this.sku = sku;
        this.name = name;
        this.quantityOnHand = quantityOnHand;
    }

    public String getSku() {
        return sku;
    }

    public String getName() {
        return name;
    }

    public int getQuantityOnHand() {
        return quantityOnHand;
    }

    public void setQuantityOnHand(int quantityOnHand) {
        this.quantityOnHand = quantityOnHand;
    }
}
