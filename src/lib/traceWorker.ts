// The worker that reads a recording of CAN frames (see traceParseClient.ts): it gets a job, answers with the reading, and has nothing else to do.
import { answerTraceJob, type TraceAnswer, type TraceJob } from './traceParseClient';

const scope = self as unknown as {
  onmessage: ((event: { data: TraceJob }) => void) | null;
  postMessage(answer: TraceAnswer): void;
};

scope.onmessage = (event) => {
  scope.postMessage(answerTraceJob(event.data));
};
