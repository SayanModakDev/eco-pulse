import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DashboardPage from "../page";

// Mock the global fetch
global.fetch = jest.fn();

describe("DashboardPage regression", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it("updates the Personalized Mitigation Plan when a new activity is submitted", async () => {
    // 1st request returns transport challenges
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          activities: [{ category: "transport", value: 10, unit: "km", description: "Drove", co2eKg: 2.1 }],
          summary: {
            totalCo2eKg: 2.1,
            dailyBaselineKg: 15,
            differenceKg: -12.9,
            percentageDifference: -86,
            status: "under_baseline",
            hotspot: { category: "transport" }
          },
          summaryInsight: "Transport Insight",
          microChallenges: [
            {
              id: "t1",
              title: "Take Public Transit",
              description: "Use bus",
              category: "transport",
              estimatedCO2SavingsKg: 5,
              projections: { weekly: 35, monthly: 150, annual: 1800 },
              difficulty: "medium"
            }
          ]
        }
      })
    });

    render(<DashboardPage />);

    const input = screen.getByPlaceholderText(/Type your daily activities here\.\.\./i);
    
    // Submit transport activity
    fireEvent.change(input, { target: { value: "drove 10km" } });
    const submitBtn = screen.getByRole("button", { name: /Submit tracked activities/i });
    fireEvent.click(submitBtn);

    // Wait for the transport challenge to appear
    await waitFor(() => {
      expect(screen.getByText("Take Public Transit")).toBeInTheDocument();
    });

    // 2nd request returns food challenges
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          activities: [{ category: "food", value: 1, unit: "meal", description: "Ate beef", co2eKg: 5.5 }],
          summary: {
            totalCo2eKg: 5.5,
            dailyBaselineKg: 15,
            differenceKg: -9.5,
            percentageDifference: -63,
            status: "under_baseline",
            hotspot: { category: "food" }
          },
          summaryInsight: "Food Insight",
          microChallenges: [
            {
              id: "f1",
              title: "Meatless Monday",
              description: "Eat less meat",
              category: "food",
              estimatedCO2SavingsKg: 4,
              projections: { weekly: 28, monthly: 120, annual: 1400 },
              difficulty: "easy"
            }
          ]
        }
      })
    });

    // Submit food activity
    fireEvent.change(input, { target: { value: "ate beef" } });
    fireEvent.click(submitBtn);

    // Wait for the food challenge to appear and old challenge to disappear
    await waitFor(() => {
      expect(screen.getByText("Meatless Monday")).toBeInTheDocument();
    });
    expect(screen.queryByText("Take Public Transit")).not.toBeInTheDocument();

    // Verify the cumulative footprint is correctly accumulated by the frontend (2.1 + 5.5 = 7.6)
    expect(screen.getByText("7.6")).toBeInTheDocument();
  });
});
