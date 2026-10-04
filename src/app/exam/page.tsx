import { QuizScreen } from "@/components/QuizScreen";

export default function ExamPage() {
  return (
    <QuizScreen
      startUrl="/api/test/start?mode=exam"
      answerUrl="/api/test/answer"
      finishUrl="/api/test/finish"
      passingThreshold={12}
      accent="blue"
      timeLimit={30 * 60}
      hideFeedback
    />
  );
}