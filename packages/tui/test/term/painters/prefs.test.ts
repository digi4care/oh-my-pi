import { expect, test } from "bun:test";
import { createRoot, isUiNode, jsx } from "@oh-my-pi/pi-tui";
import { paintNode, staticEnvironment } from "@oh-my-pi/pi-tui/term/paint";
import "@oh-my-pi/pi-tui/term/painters/index";
import { PREFS_SEARCH_ROLE } from "@oh-my-pi/pi-tui/term/painters/prefs";
import { stripEscapes } from "@oh-my-pi/pi-tui/text/ansi";
import { visibleWidth } from "@oh-my-pi/pi-tui/text/width";
import { loadThemeSync } from "@oh-my-pi/pi-tui/theme/loader";

const QUERY = "abcdef";
const WIDTH = 72;
const theme = loadThemeSync("dark");

function paintPrefs(options: { legacyCursor?: number; childCursor?: number } = {}): string[] {
	return createRoot(dispose => {
		try {
			const child =
				options.childCursor === undefined
					? undefined
					: jsx("input", {
							role: PREFS_SEARCH_ROLE,
							text: QUERY,
							cursor: options.childCursor,
						});
			const node = jsx("prefs", {
				title: "Preferences",
				pages: [{ id: "general", label: "General" }],
				page: "general",
				query: QUERY,
				sections: [],
				...(options.legacyCursor === undefined ? {} : { cursor: options.legacyCursor }),
				...(child === undefined ? {} : { children: child }),
			});
			if (!isUiNode(node)) throw new Error("expected a prefs node");
			return [...paintNode(staticEnvironment(theme), node, WIDTH, 20).rows];
		} finally {
			dispose();
		}
	});
}

function expectCaretAt(rows: readonly string[], offset: number): void {
	const row = rows.find(candidate => stripEscapes(candidate).includes(QUERY));
	if (row === undefined) throw new Error("search query was not rendered");

	const rendered = stripEscapes(row);
	const queryStart = rendered.indexOf(QUERY);
	const caretStart = row.indexOf("\x1b[7m");
	if (queryStart < 0 || caretStart < 0) throw new Error("search query or visible caret was not rendered");
	const cellStart = caretStart + "\x1b[7m".length;
	const caretEnd = row.indexOf("\x1b[27m", cellStart);
	if (caretEnd < 0) throw new Error("rendered caret cell was not closed");

	const caretCell = row.slice(cellStart, caretEnd);
	const caretColumn = visibleWidth(stripEscapes(row.slice(0, caretStart)));
	const queryColumn = visibleWidth(rendered.slice(0, queryStart));
	expect(rendered).toContain(QUERY);
	expect(caretColumn).toBe(queryColumn + offset);
	expect(caretCell).toBe(offset === QUERY.length ? " " : QUERY[offset]);
}

test("legacy prefs cursor paints the caret mid-query without a search child", () => {
	expectCaretAt(paintPrefs({ legacyCursor: 2 }), 2);
});

test("search child cursor takes precedence over a legacy prefs cursor", () => {
	expectCaretAt(paintPrefs({ legacyCursor: 1, childCursor: 4 }), 4);
});

test("search caret defaults to query end when neither cursor is present", () => {
	expectCaretAt(paintPrefs(), QUERY.length);
});
