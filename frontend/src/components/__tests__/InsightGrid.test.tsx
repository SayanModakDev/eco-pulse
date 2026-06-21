import { render, screen, fireEvent } from "@testing-library/react";
import InsightGrid from "../InsightGrid";

const mockChallenges = [
  {
    title: "Test Challenge 1",
    description: "Test Description 1",
    estimatedCO2SavingsKg: 5,
    difficulty: "easy" as const,
    category: "transport" as const,
    projections: {
      weekly: 35,
      monthly: 150,
      annual: 1825,
    },
  },
  {
    title: "Test Challenge 2",
    description: "Test Description 2",
    estimatedCO2SavingsKg: 10,
    difficulty: "medium" as const,
    category: "food" as const,
    projections: {
      weekly: 70,
      monthly: 300,
      annual: 3650,
    },
  },
];

describe("InsightGrid Component", () => {
  it("renders empty state when no challenges provided", () => {
    render(<InsightGrid challenges={[]} completedChallenges={{}} onToggleChallenge={jest.fn()} />);
    expect(screen.getByText(/No challenges available/i)).toBeInTheDocument();
  });

  it("renders challenges when provided", () => {
    render(<InsightGrid challenges={mockChallenges} completedChallenges={{}} onToggleChallenge={jest.fn()} />);
    expect(screen.getByText("Test Challenge 1")).toBeInTheDocument();
    expect(screen.getByText("Test Challenge 2")).toBeInTheDocument();
    expect(screen.getByText("-5 kg/day CO₂e")).toBeInTheDocument();
  });

  it("calls onToggleChallenge when completion button is clicked", () => {
    const handleToggle = jest.fn();
    const { rerender } = render(
      <InsightGrid challenges={[mockChallenges[0]]} completedChallenges={{}} onToggleChallenge={handleToggle} />
    );
    const button = screen.getByRole("button", {
      name: /Mark "Test Challenge 1" challenge as complete/i,
    });

    // Initial state
    expect(button).toHaveTextContent("Complete Challenge");
    expect(button).toHaveAttribute("aria-pressed", "false");

    // Click to complete
    fireEvent.click(button);
    expect(handleToggle).toHaveBeenCalledWith("Test Challenge 1");

    // Simulate parent state update
    rerender(
      <InsightGrid challenges={[mockChallenges[0]]} completedChallenges={{ "Test Challenge 1": true }} onToggleChallenge={handleToggle} />
    );

    expect(button).toHaveTextContent("Undo Action");
    expect(button).toHaveAttribute("aria-pressed", "true");
  });
});
