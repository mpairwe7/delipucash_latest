/**
 * Legacy question route — redirects to the canonical question-answer screen.
 *
 * This file existed as a standalone answer screen but was superseded by
 * `/question-answer/[id]` which uses the consolidated questionHooks + Zustand
 * architecture (draft persistence, submission guard, auth check, optimistic
 * updates, cache-key unification with the feed).
 *
 * Kept as a redirect so any deep-links or cached URLs still resolve correctly.
 */

import { Redirect, useLocalSearchParams } from "expo-router";
import type { Href } from "expo-router";
import React from "react";

export default function LegacyQuestionRedirect(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/question-answer/${id ?? ""}` as Href} />;
}
