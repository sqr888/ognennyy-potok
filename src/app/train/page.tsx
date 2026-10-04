import { QuizScreen } from "@/components/QuizScreen";

export default function TrainPage() {
  return (
    <QuizScreen
      startUrl="/api/train/start"
      finishUrl="/api/train/finish"
      resultTitle="Тренировка завершена!"
      accent="emerald"
      showTopicPicker
    />
  );
}