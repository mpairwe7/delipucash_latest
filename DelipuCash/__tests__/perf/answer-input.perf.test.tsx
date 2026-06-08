/**
 * Performance regression guard — AnswerInput (memoized) typing commit count.
 *
 * Input re-render storms are the classic RN perf bug. A controlled host feeds each
 * keystroke to the memoized AnswerInput; we assert that typing N characters costs exactly
 * N+1 commits (initial mount + one per keystroke). A regression that double-renders or
 * introduces an effect loop would raise the count and fail here.
 *
 * Runs in the normal suite (fast). See test-utils/renderWithProfiler for why this replaces
 * Reassure under React 19.
 */
import React, { Profiler, useState } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AnswerInput } from '@/components/question/QuestionDetailLayout';

const TYPED = 'a thoughtful, detailed answer';

test('typing N characters costs exactly N+1 commits', () => {
  let commits = 0;

  function ControlledAnswerInput() {
    const [value, setValue] = useState('');
    return (
      <Profiler id="answer-input" onRender={() => { commits += 1; }}>
        <AnswerInput value={value} onChangeText={setValue} onSubmit={() => {}} />
      </Profiler>
    );
  }

  const { getByLabelText } = render(<ControlledAnswerInput />);
  const input = getByLabelText('Answer input');

  let text = '';
  for (const ch of TYPED) {
    text += ch;
    fireEvent.changeText(input, text);
  }

  // initial mount (1) + one commit per keystroke
  expect(commits).toBe(TYPED.length + 1);
});
