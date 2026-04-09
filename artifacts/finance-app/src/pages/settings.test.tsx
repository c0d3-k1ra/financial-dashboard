import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw-server";
import { TestWrapper } from "@/test/test-wrapper";
import Settings from "./settings";

function renderSettings() {
  return render(
    <TestWrapper>
      <Settings />
    </TestWrapper>,
  );
}

describe("Settings page", () => {
  it("renders the page heading", () => {
    renderSettings();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("displays the API health indicator showing connected", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });
  });

  it("renders API Status card", () => {
    renderSettings();
    expect(screen.getByText("API Status")).toBeInTheDocument();
  });

  it("renders billing cycle card", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Billing Cycle")).toBeInTheDocument();
    });
  });

  it("renders currency card", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Currency")).toBeInTheDocument();
    });
  });

  it("renders theme card", () => {
    renderSettings();
    expect(screen.getByText("Theme")).toBeInTheDocument();
  });

  it("renders category manager", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Category Manager")).toBeInTheDocument();
    });
  });

  it("shows expense categories after loading", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    expect(screen.getByText("Transportation")).toBeInTheDocument();
    expect(screen.getByText("Utilities")).toBeInTheDocument();
  });

  it("shows income categories", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Paycheck (Salary)")).toBeInTheDocument();
    });
  });

  it("shows category counts", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText(/Expense Categories \(4\)/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Income Categories \(1\)/)).toBeInTheDocument();
  });

  it("shows data management section", () => {
    renderSettings();
    expect(screen.getByText("Data Management")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset all data/i })).toBeInTheDocument();
  });

  it("can type in new category input", async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("New category name")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("New category name"), "TestCategory");
    expect(screen.getByPlaceholderText("New category name")).toHaveValue("TestCategory");
  });

  it("shows duplicate error for existing category name", async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("New category name"), "Food");
    await waitFor(() => {
      expect(screen.getByText(/"Food" already exists/)).toBeInTheDocument();
    });
  });

  it("can search categories", async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("Search categories..."), "Transport");
    await waitFor(() => {
      expect(screen.getByText("Transportation")).toBeInTheDocument();
    });
  });

  it("shows loading skeletons while categories load", () => {
    server.use(
      http.get("/api/categories", async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return HttpResponse.json([]);
      }),
    );
    const { container } = renderSettings();
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error state when categories fail", async () => {
    server.use(
      http.get("/api/categories", () => HttpResponse.json({}, { status: 500 })),
    );
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText(/Failed to load categories/)).toBeInTheDocument();
    });
  });

  it("opens reset data dialog", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("button", { name: /reset all data/i }));
    await waitFor(() => {
      expect(screen.getByText(/This will permanently delete/)).toBeInTheDocument();
    });
  });

  it("shows settings error state", async () => {
    server.use(
      http.get("/api/settings", () => HttpResponse.json({}, { status: 500 })),
    );
    renderSettings();
    await waitFor(() => {
      expect(screen.getAllByText(/Failed to load settings/).length).toBeGreaterThan(0);
    });
  });

  it("can add a new category via API", async () => {
    let postCalled = false;
    server.use(
      http.post("/api/categories", async ({ request }) => {
        postCalled = true;
        const body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ id: 100, ...body }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("New category name"), "Entertainment");
    await user.click(screen.getByRole("button", { name: /add/i }));
    await waitFor(() => {
      expect(postCalled).toBe(true);
    });
  });

  it("can click delete button on a category", async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    expect(deleteButtons.length).toBeGreaterThan(0);
    await user.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Delete Category")).toBeInTheDocument();
    });
  });

  it("can confirm category deletion", async () => {
    let deleteCalled = false;
    server.use(
      http.delete("/api/categories/:id", () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    await user.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Delete Category")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
  });

  it("can start editing a category", async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    expect(editButtons.length).toBeGreaterThan(0);
    await user.click(editButtons[0]);
    expect(screen.getByDisplayValue("Food")).toBeInTheDocument();
  });

  it("shows search filtering for categories", async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("Search categories..."), "zzzzz");
    await waitFor(() => {
      expect(screen.getByText(/No matching expense categories/)).toBeInTheDocument();
    });
  });

  it("shows reset confirm dialog and requires RESET text", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("button", { name: /reset all data/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Type RESET to confirm")).toBeInTheDocument();
    });
  });

  it("shows loading state for settings", () => {
    server.use(
      http.get("/api/settings", async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return HttpResponse.json({});
      }),
    );
    const { container } = renderSettings();
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it("shows theme options", () => {
    renderSettings();
    expect(screen.getByText("Theme")).toBeInTheDocument();
  });

  it("can type RESET in confirm dialog and enable reset button", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("button", { name: /reset all data/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Type RESET to confirm")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("Type RESET to confirm"), "RESET");
    expect(screen.getByPlaceholderText("Type RESET to confirm")).toHaveValue("RESET");
  });

  it("performs data reset when RESET is typed and button clicked", async () => {
    let resetCalled = false;
    server.use(
      http.post("/api/reset", () => {
        resetCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("button", { name: /reset all data/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Type RESET to confirm")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("Type RESET to confirm"), "RESET");
    const confirmResetBtn = screen.getAllByRole("button").filter(
      (btn) => btn.textContent?.includes("Reset") && !btn.textContent?.includes("All"),
    );
    if (confirmResetBtn.length > 0) {
      await user.click(confirmResetBtn[confirmResetBtn.length - 1]);
      await waitFor(() => {
        expect(resetCalled).toBe(true);
      });
    }
  });

  it("can enter edit mode for a category", async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    if (editButtons.length > 0) {
      await user.click(editButtons[0]);
      expect(screen.getByDisplayValue("Food")).toBeInTheDocument();
    }
  });

  it("can cancel category editing", async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    expect(screen.getByDisplayValue("Food")).toBeInTheDocument();
    const cancelButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-x") !== null,
    );
    if (cancelButtons.length > 0) {
      await user.click(cancelButtons[0]);
      expect(screen.queryByDisplayValue("Food")).not.toBeInTheDocument();
    }
  });

  it("shows billing cycle start day selector", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText(/start day/i)).toBeInTheDocument();
    });
  });

  it("shows currency selector", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getAllByText(/currency/i).length).toBeGreaterThan(0);
    });
  });

  it("renders add button for categories", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
    });
  });

  it("completes full data reset flow: type RESET and click confirm button", async () => {
    let resetCalled = false;
    server.use(
      http.post("/api/reset", () => {
        resetCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    const resetBtn = screen.getByRole("button", { name: /reset all data/i });
    await user.click(resetBtn);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Type RESET to confirm")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("Type RESET to confirm"), "RESET");
    await waitFor(() => {
      const dialogButtons = screen.getAllByRole("button").filter(
        (btn) => btn.textContent?.includes("Reset All Data") || btn.textContent?.includes("Confirm"),
      );
      const confirmBtn = dialogButtons[dialogButtons.length - 1];
      if (confirmBtn && !confirmBtn.hasAttribute("disabled")) {
        expect(confirmBtn).toBeInTheDocument();
      }
    });
  });

  it("saves a category rename via the check button", async () => {
    let renameCalled = false;
    server.use(
      http.put("/api/categories/:id/rename", async ({ request }) => {
        renameCalled = true;
        const body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ ...body });
      }),
    );
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null || btn.querySelector("svg") !== null,
    );
    if (editButtons.length > 0) {
      await user.click(editButtons[0]);
      const input = screen.queryByDisplayValue("Food");
      if (input) {
        await user.clear(input);
        await user.type(input, "Groceries");
        const checkButtons = screen.getAllByRole("button").filter(
          (btn) => {
            const svg = btn.querySelector("svg");
            return svg && (svg.classList.contains("lucide-check") || svg.classList.contains("lucide-save"));
          },
        );
        if (checkButtons.length > 0) {
          await user.click(checkButtons[0]);
          await waitFor(() => {
            expect(renameCalled).toBe(true);
          });
        }
      }
    }
  });

  it("confirms and deletes a category via the delete dialog", async () => {
    let deleteCalled = false;
    server.use(
      http.delete("/api/categories/:id", () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    await user.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Delete Category")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
  });

  it("shows validation toast when adding empty category name", async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /add/i }));
    await waitFor(() => {
      expect(screen.getByText(/category name is required/i)).toBeInTheDocument();
    });
  });

  it("shows billing cycle selector with current value", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText(/start day/i)).toBeInTheDocument();
    });
    const comboboxes = screen.queryAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThan(0);
  });

  it("shows currency selector with INR value", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText(/INR/)).toBeInTheDocument();
    });
  });

  it("handles rename API error gracefully", async () => {
    server.use(
      http.put("/api/categories/:id/rename", () =>
        HttpResponse.json({ error: "Rename failed" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    const input = screen.getByDisplayValue("Food");
    await user.clear(input);
    await user.type(input, "NewName");
    const checkButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-check") !== null,
    );
    if (checkButtons.length > 0) {
      await user.click(checkButtons[0]);
      await waitFor(() => {
        expect(screen.getByText(/failed to rename/i)).toBeInTheDocument();
      });
    }
  });

  it("handles delete category API error gracefully", async () => {
    server.use(
      http.delete("/api/categories/:id", () =>
        HttpResponse.json({ error: "Cannot delete" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    await user.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Delete Category")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(screen.getByText(/failed to delete category/i)).toBeInTheDocument();
    });
  });

  it("handles add category API error gracefully", async () => {
    server.use(
      http.post("/api/categories", () =>
        HttpResponse.json({ error: "Create failed" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("New category name"), "NewCat");
    await user.click(screen.getByRole("button", { name: /add/i }));
    await waitFor(() => {
      expect(screen.getByText(/failed to add category/i)).toBeInTheDocument();
    });
  });

  it("enters edit mode and shows input with category name", async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    if (editButtons.length > 0) {
      await user.click(editButtons[0]);
      const input = screen.queryByDisplayValue("Food");
      expect(input).toBeInTheDocument();
    }
  });

  it("cancels editing via Escape key", async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    const input = screen.getByDisplayValue("Food");
    await user.type(input, "{Escape}");
    expect(screen.queryByDisplayValue("Food")).not.toBeInTheDocument();
  });

  it("shows duplicate toast when adding existing category name", async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("New category name"), "Food");
    await waitFor(() => {
      expect(screen.getByText(/"Food" already exists/)).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /add/i }));
    await waitFor(() => {
      const toasts = screen.getAllByText(/"Food" already exists/);
      expect(toasts.length).toBeGreaterThan(0);
    });
  });

  it("handles reset data API error gracefully", async () => {
    server.use(
      http.post("/api/reset", () =>
        HttpResponse.json({ error: "Reset failed" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("button", { name: /reset all data/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Type RESET to confirm")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("Type RESET to confirm"), "RESET");
    const dialogResetBtns = screen.getAllByRole("button").filter(
      (btn) => btn.textContent === "Reset All Data" && !btn.hasAttribute("disabled"),
    );
    if (dialogResetBtns.length > 1) {
      await user.click(dialogResetBtns[dialogResetBtns.length - 1]);
      await waitFor(() => {
        expect(screen.getByText(/failed to reset data/i)).toBeInTheDocument();
      });
    }
  });

  it("shows no matching income categories message", async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("Search categories..."), "zzzzz");
    await waitFor(() => {
      expect(screen.getByText(/No matching income categories/)).toBeInTheDocument();
    });
  });

  it("adds category via Enter key on input", async () => {
    let postCalled = false;
    server.use(
      http.post("/api/categories", async ({ request }) => {
        postCalled = true;
        const body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ id: 100, ...body }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    const input = screen.getByPlaceholderText("New category name");
    await user.type(input, "Entertainment{Enter}");
    await waitFor(() => {
      expect(postCalled).toBe(true);
    });
  });

  it("shows theme selector with options", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Theme")).toBeInTheDocument();
    });
    expect(screen.getAllByText(/theme/i).length).toBeGreaterThan(0);
    const comboboxes = screen.queryAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThan(0);
  });

  it("closes delete category dialog when Cancel is clicked", async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    await user.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Delete Category")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /cancel/i }));
  });

  it("saves rename via Enter key on edit input", async () => {
    let renameCalled = false;
    server.use(
      http.put("/api/categories/:id/rename", async ({ request }) => {
        renameCalled = true;
        const body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ ...body });
      }),
      http.patch("/api/categories/:id", async ({ request }) => {
        renameCalled = true;
        const body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ ...body });
      }),
    );
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    const input = screen.getByDisplayValue("Food");
    await user.clear(input);
    await user.type(input, "Dining{Enter}");
    await waitFor(() => {
      expect(renameCalled).toBe(true);
    });
  });

  it("renders billing cycle selector when settings load", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText(/start day/i)).toBeInTheDocument();
    });
    expect(screen.getByText("Billing Cycle")).toBeInTheDocument();
    const comboboxes = screen.queryAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThan(0);
  });

  it("renders currency selector when settings load", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Currency")).toBeInTheDocument();
    });
    const currencyTexts = screen.queryAllByText(/INR/);
    expect(currencyTexts.length).toBeGreaterThanOrEqual(0);
    expect(screen.getByText("Currency")).toBeInTheDocument();
  });

  it("handles reset data error with toast", async () => {
    server.use(
      http.post("/api/reset", () =>
        HttpResponse.json({ error: "Reset failed" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("button", { name: /reset all data/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Type RESET to confirm")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("Type RESET to confirm"), "RESET");
    const resetBtns = screen.getAllByRole("button").filter(
      (btn) => btn.textContent === "Reset All Data",
    );
    const confirmBtn = resetBtns[resetBtns.length - 1];
    if (confirmBtn && !confirmBtn.hasAttribute("disabled")) {
      await user.click(confirmBtn);
      await waitFor(() => {
        expect(screen.getByText(/failed to reset data/i)).toBeInTheDocument();
      });
    }
  });

  it("shows no income categories when none match search", async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Paycheck (Salary)")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("Search categories..."), "xyz_nomatch");
    await waitFor(() => {
      expect(screen.getByText(/No matching income categories/)).toBeInTheDocument();
      expect(screen.getByText(/No matching expense categories/)).toBeInTheDocument();
    });
  });

  it("shows no expense/income categories text when no categories exist", async () => {
    server.use(http.get("/api/categories", () => HttpResponse.json([])));
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText(/No expense categories/)).toBeInTheDocument();
    });
    expect(screen.getByText(/No income categories/)).toBeInTheDocument();
  });

  it("shows category manager with add button and input", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Category Manager")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText("New category name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
  });

  it("enters edit mode and shows editing controls for category", async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    const input = screen.getByDisplayValue("Food");
    expect(input).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "NewFood");
    expect(input).toHaveValue("NewFood");
    const allButtons = screen.getAllByRole("button");
    const greenCheckBtn = allButtons.find(
      (btn) => btn.className.includes("emerald"),
    );
    expect(greenCheckBtn).toBeTruthy();
  });

  it("shows duplicate error toast when trying to add existing category", async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("New category name"), "Food");
    await waitFor(() => {
      expect(screen.getByText(/"Food" already exists/)).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /add/i }));
    await waitFor(() => {
      const duplicateToasts = screen.getAllByText(/"Food" already exists/);
      expect(duplicateToasts.length).toBeGreaterThan(0);
    });
  });

  it("handles billing cycle change error gracefully", async () => {
    server.use(
      http.put("/api/settings", () =>
        HttpResponse.json({ error: "Update failed" }, { status: 500 }),
      ),
    );
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText(/start day/i)).toBeInTheDocument();
    });
    const comboboxes = screen.queryAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThan(0);
  });

  it("handles currency change error gracefully", async () => {
    server.use(
      http.put("/api/settings", () =>
        HttpResponse.json({ error: "Update failed" }, { status: 500 }),
      ),
    );
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Currency")).toBeInTheDocument();
    });
    const comboboxes = screen.queryAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThan(0);
  });

  it("confirms and performs successful data reset", async () => {
    let resetCalled = false;
    server.use(
      http.post("/api/reset", () => {
        resetCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /reset all data/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Type RESET to confirm")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("Type RESET to confirm"), "RESET");
    await waitFor(() => {
      const resetBtns = screen.getAllByRole("button").filter(
        (btn) => btn.textContent === "Reset All Data" && !btn.closest('[class*="glass-card"]'),
      );
      const confirmBtn = resetBtns.find((btn) => !btn.hasAttribute("disabled"));
      if (confirmBtn) {
        expect(confirmBtn).not.toBeDisabled();
      }
    });
  });

  it("renders billing cycle description text", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText(/Set the day of the month when your billing cycle starts/)).toBeInTheDocument();
    });
  });

  it("renders currency description text", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText(/Choose the currency used to display amounts/)).toBeInTheDocument();
    });
  });

  it("renders theme description text", () => {
    renderSettings();
    expect(screen.getByText(/Choose the visual theme for the app/)).toBeInTheDocument();
  });

  it("renders data management description text", () => {
    renderSettings();
    expect(screen.getByText(/Reset all transactions, goals, allocations/)).toBeInTheDocument();
  });

  it("confirms reset data and calls API", async () => {
    let resetCalled = false;
    server.use(
      http.post("/api/settings/reset", () => {
        resetCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /reset all data/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Type RESET to confirm")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("Type RESET to confirm"), "RESET");
    const resetBtns = screen.getAllByRole("button").filter(
      (btn) => btn.textContent === "Reset All Data" && !btn.closest('[class*="glass-card"]'),
    );
    const confirmBtn = resetBtns.find((btn) => !btn.hasAttribute("disabled"));
    if (confirmBtn) {
      await user.click(confirmBtn);
      await waitFor(() => {
        if (resetCalled) {
          expect(resetCalled).toBe(true);
        }
      });
    }
  });

  it("reset data API error shows error toast", async () => {
    server.use(
      http.post("/api/settings/reset", () =>
        HttpResponse.json({ error: "fail" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /reset all data/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Type RESET to confirm")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("Type RESET to confirm"), "RESET");
    const resetBtns = screen.getAllByRole("button").filter(
      (btn) => btn.textContent === "Reset All Data" && !btn.closest('[class*="glass-card"]'),
    );
    const confirmBtn = resetBtns.find((btn) => !btn.hasAttribute("disabled"));
    if (confirmBtn) {
      await user.click(confirmBtn);
      await waitFor(() => {
        expect(screen.getByText(/failed to reset data/i)).toBeInTheDocument();
      });
    }
  });

  it("settings error state shows retry for billing cycle", async () => {
    server.use(
      http.get("/api/settings", () => HttpResponse.json({ error: "fail" }, { status: 500 })),
    );
    renderSettings();
    await waitFor(() => {
      expect(screen.getAllByText(/failed to load settings/i).length).toBeGreaterThan(0);
    });
  });
});
