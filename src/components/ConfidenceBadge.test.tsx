import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ConfidenceBadge, MEDIAN_BADGE_TOOLTIP } from "./ConfidenceBadge";

afterEach(cleanup);

describe("ConfidenceBadge", () => {
  it("shows the historical median badge and the median number for train_median", () => {
    render(<ConfidenceBadge beatsNaive={false} pointSource="train_median" pointDays={3.0365} />);
    expect(screen.getByText("Historical median estimate")).toBeInTheDocument();
    expect(screen.getByTestId("median-point")).toHaveTextContent("3.0 days");
    expect(screen.queryByText("Model below naive baseline")).toBeNull();
  });

  it("keeps the old behaviour when the source field is absent (old server)", () => {
    render(<ConfidenceBadge beatsNaive={false} />);
    expect(screen.getByText("Model below naive baseline")).toBeInTheDocument();
    expect(screen.queryByText("Historical median estimate")).toBeNull();
    cleanup();
    const { container } = render(<ConfidenceBadge beatsNaive pointSource="model" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not throw and omits the number when pointDays is null", () => {
    render(<ConfidenceBadge beatsNaive pointSource="train_median" pointDays={null} />);
    expect(screen.getByText("Historical median estimate")).toBeInTheDocument();
    expect(screen.queryByTestId("median-point")).toBeNull();
  });

  it("carries the required tooltip text", () => {
    expect(MEDIAN_BADGE_TOOLTIP).toMatch(/^The trained model for this repository did not beat/);
    expect(MEDIAN_BADGE_TOOLTIP).toMatch(/Use the range, not the single number\.$/);
  });
});
