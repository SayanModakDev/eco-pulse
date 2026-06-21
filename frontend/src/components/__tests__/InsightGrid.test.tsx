import { render, screen, fireEvent } from "@testing-library/react";
import InsightGrid from "../InsightGrid";

const mockChallenges = [
  {
    title: "Test Challenge 1",
    description: "Test Description 1",
    potentialSavingKg: 5,
    difficulty: "easy" as const,
    category: "transport" as const,
  },
  {
    title: "Test Challenge 2",
    description: "Test Description 2",
    potentialSavingKg: 10,
    difficulty: "medium" as const,
    category: "food" as const,
  },
];

describe("InsightGrid Component", () => {
  it("renders empty state when no challenges provided", () => {
    render(<InsightGrid challenges={[]} />);
    expect(screen.getByText(/No challenges available/i)).toBeInTheDocument();
  });

  it("renders challenges when provided", () => {
    render(<InsightGrid challenges={mockChallenges} />);
    expect(screen.getByText("Test Challenge 1")).toBeInTheDocument();
    expect(screen.getByText("Test Challenge 2")).toBeInTheDocument();
    expect(screen.getByText("-5 kg CO₂e")).toBeInTheDocument();
  });

  it("toggles challenge completion state on button click", () => {
    render(<InsightGrid challenges={[mockChallenges[0]]} />);
    const button = screen.getByRole("button", {
      name: /Mark "Test Challenge 1" challenge as complete/i,
    });

    // Initial state
    expect(button).toHaveTextContent("Complete Challenge");
    expect(button).toHaveAttribute("aria-pressed", "false");

    // Click to complete
    fireEvent.click(button);
    expect(button).toHaveTextContent("Undo Action");
    expect(button).toHaveAttribute("aria-pressed", "true");

    // Click to undo
    fireEvent.click(button);
    expect(button).toHaveTextContent("Complete Challenge");
    expect(button).toHaveAttribute("aria-pressed", "false");
  });
});
