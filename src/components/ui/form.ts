"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Submits a form through its `useActionState` action without React's automatic form reset,
 * so what the operator typed survives a server-side validation error. The `action` prop
 * stays on the form as the no-JavaScript fallback.
 */
export function submitWithoutReset(formAction: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter instanceof HTMLElement ? submitter : null);
    startTransition(() => formAction(formData));
  };
}
