package com.serviceforge.controller;

import com.serviceforge.data.MockDataStore;
import com.serviceforge.model.Part;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = PartController.class)
class PartControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private MockDataStore dataStore;

    @BeforeEach
    void setUp() {
        given(dataStore.findPart("CMP-CLUTCH")).willReturn(Optional.of(new Part("CMP-CLUTCH", "Compressor Clutch", 1)));
        given(dataStore.findPart("NOPE-1")).willReturn(Optional.empty());
    }

    @Test
    void getPart_returnsPartWhenFound() throws Exception {
        mockMvc.perform(get("/api/parts/CMP-CLUTCH").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"sku\":\"CMP-CLUTCH\",\"name\":\"Compressor Clutch\",\"quantityOnHand\":1}"));
    }

    @Test
    void getPart_returns404WhenNotFound() throws Exception {
        mockMvc.perform(get("/api/parts/NOPE-1").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound());
    }
}
