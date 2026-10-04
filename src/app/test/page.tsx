import { QuizScreen } from "@/components/QuizScreen";

export default function TestPage() {
  return (
    <QuizScreen
      startUrl="/api/test/start"
      answerUrl="/api/test/answer"
      finishUrl="/api/test/finish"
      passingThreshold={12}
      accent="blue"
    />
  );
}