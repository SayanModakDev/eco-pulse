import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ActionTracker from '../ActionTracker';

/**
 * TESTING (Low Impact):
 * Demonstrates component-level testability for accessible React structures.
 * Verifies that ARIA labels and core functional rendering behave as expected.
 */
describe('ActionTracker Component', () => {
  it('renders the accessible text area', () => {
    render(<ActionTracker onTrack={jest.fn()} isLoading={false} />);
    
    // Checks that the accessible input is present
    const textarea = screen.getByLabelText(/Daily activity description/i);
    expect(textarea).toBeInTheDocument();
  });

  it('renders loading state correctly', () => {
    render(<ActionTracker onTrack={jest.fn()} isLoading={true} />);
    
    const textarea = screen.getByLabelText(/Daily activity description/i);
    expect(textarea).toBeDisabled();
    
    const submitButton = screen.getByRole('button', { name: /Submitting activities/i });
    expect(submitButton).toBeDisabled();
  });
});
