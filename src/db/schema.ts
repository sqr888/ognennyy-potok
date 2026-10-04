import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Topics ────────────────────────────────────────────────────────────────
export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().unique(),
  orderIndex: integer("order_index").notNull().unique(),
});

// ─── Questions ─────────────────────────────────────────────────────────────
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  imageUrl: text("image_url"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Answers ───────────────────────────────────────────────────────────────
export const answers = pgTable("answers", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
});

// ─── Attempts ──────────────────────────────────────────────────────────────
// selectedQuestions stores [{questionId, answeredId, isCorrect}] per attempt
export const attempts = pgTable("attempts", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  correctCount: integer("correct_count").notNull().default(0),
  totalCount: integer("total_count").notNull().default(0),
  finished: boolean("finished").notNull().default(false),
  // Режим попытки: "test" | "exam" | "train"
  mode: text("mode").notNull().default("test"),
  // JSON array: {questionId: number, correctAnswerId: number}[]
  questionMap: jsonb("question_map").notNull().default("[]"),
  // JSON array: {questionId: number, answeredId: number, isCorrect: boolean}[]
  answers: jsonb("answers").notNull().default("[]"),
});

// ─── Relations ─────────────────────────────────────────────────────────────
export const topicsRelations = relations(topics, ({ many }) => ({
  questions: many(questions),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  topic: one(topics, { fields: [questions.topicId], references: [topics.id] }),
  answers: many(answers),
}));

export const answersRelations = relations(answers, ({ one }) => ({
  question: one(questions, {
    fields: [answers.questionId],
    references: [questions.id],
  }),
}));
