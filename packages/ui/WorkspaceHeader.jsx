import React from "react";
import { View, Text, Platform } from "react-native";
import { complement } from "../shared/index.js";

export const example = "ACGTTGCAAGTCCGATGGCATTCG";
export const baseColors = {
  A: "#a8dc79",
  C: "#68cabc",
  G: "#edb56b",
  T: "#b59cdd",
};
const display = Platform.select({
  web: "Georgia, serif",
  ios: "Georgia",
  android: "serif",
});

export function Brand() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <View
        accessible={false}
        style={{
          flexDirection: "row",
          gap: 3,
          alignItems: "center",
          backgroundColor: "#244537",
          padding: 8,
          borderRadius: 10,
        }}
      >
        {[10, 19, 13].map((height, i) => (
          <View
            key={i}
            style={{
              width: 4,
              height,
              borderRadius: 4,
              backgroundColor: "#d3ecae",
              transform: [{ rotate: "16deg" }],
            }}
          />
        ))}
      </View>
      <Text
        style={{
          color: "#233e33",
          fontSize: 25,
          fontWeight: "700",
          letterSpacing: -1.3,
        }}
      >
        GeneScan
      </Text>
    </View>
  );
}

export function WorkspaceHeader({ page, wide, result }) {
  const seq = (result?.sequence || example).slice(0, 24);
  return (
    <View
      style={{
        backgroundColor: "#224737",
        borderRadius: 20,
        overflow: "hidden",
        paddingHorizontal: wide ? 36 : 22,
        paddingVertical: wide ? 30 : 22,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 20,
      }}
    >
      <View style={{ flex: 1, gap: 9 }}>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: display,
            fontSize: wide ? 47 : 33,
            letterSpacing: -1.7,
            color: "#f8f8ed",
          }}
        >
          {page === "Analyzer"
            ? "Sequence analyzer"
            : page === "Dashboard"
              ? "Analysis dashboard"
              : "Your account"}
        </Text>
        <Text style={{ color: "#d7e5d6", fontSize: 15, lineHeight: 22 }}>
          {page === "Analyzer"
            ? "Explore base composition, GC content and reverse complements."
            : page === "Dashboard"
              ? "Review your saved sequences and recent activity."
              : "Access your private sequence library."}
        </Text>
      </View>
      {wide && (
        <View
          accessible
          accessibilityLabel="Illustration of paired DNA bases"
          style={{
            flexDirection: "row",
            height: 98,
            alignItems: "center",
            gap: 5,
            paddingHorizontal: 12,
          }}
        >
          {[...seq].map((base, i) => {
            const phase = Math.sin(i * 0.31);
            return (
              <View
                key={i}
                style={{
                  height: 7 + 78 * Math.abs(phase),
                  width: 6,
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: "#607f67",
                  borderRadius: 5,
                }}
              >
                {[
                  phase >= 0 ? base : complement[base],
                  phase >= 0 ? complement[base] : base,
                ].map((b, j) => (
                  <View
                    key={j}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: baseColors[b] || "#dae5d3",
                    }}
                  />
                ))}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
