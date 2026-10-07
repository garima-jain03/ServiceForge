package com.serviceforge.data;

import com.serviceforge.model.Part;
import com.serviceforge.model.PartReservation;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;

class MockDataStoreConcurrencyTest {

    @Test
    void concurrentReserve_onlyOneSucceedsAgainstSingleUnit() throws Exception {
        MockDataStore store = new MockDataStore();
        store.seed();

        // Ensure CMP-CLUTCH has quantity 1 per seed.
        Part clutch = store.findPart("CMP-CLUTCH").orElseThrow();
        assertEquals(1, clutch.getQuantityOnHand());

        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(2);
        AtomicInteger successCount = new AtomicInteger(0);

        Runnable tryReserve = () -> {
            try {
                start.await();
                try {
                    PartReservation r = store.reservePart("CMP-CLUTCH", 1L, 1);
                    if (r != null) successCount.incrementAndGet();
                } catch (Exception e) {
                    // expected for the loser
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                done.countDown();
            }
        };

        Thread t1 = new Thread(tryReserve);
        Thread t2 = new Thread(tryReserve);
        t1.start();
        t2.start();

        // start both threads simultaneously
        start.countDown();
        done.await();

        assertEquals(1, successCount.get(), "Exactly one reservation must succeed");

        // stock must be 0 now
        assertEquals(0, clutch.getQuantityOnHand());
    }
}
