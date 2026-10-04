// src/lib/mdParser.ts

export interface ParsedAnswer {
  text: string;
  isCorrect: boolean;
}

export interface ParsedQuestion {
  text: string;
  imageUrl: string | null;
  description: string | null;
  answers: ParsedAnswer[];
}

export interface ParsedChapter {
  title: string;
  questions: ParsedQuestion[];
}

/**
 * Parse one .md file representing one chapter (topic).
 *
 * Поддерживаемые форматы заголовка главы:
 *   # Глава: Название
 *   # Глава 1. Название
 *   ## Глава 1. Название
 *   # Тема: Название
 *   Глава 1. Название          (без #)
 *
 * Формат вопроса:
 *   ## Вопрос: <текст>
 *   ## Вопрос 1. <текст>
 *   ![image](path/to/img.png)   <!-- опционально -->
 *
 *   - [ ] Вариант 1
 *   - [x] Вариант 2             <!-- правильный -->
 *   - [ ] Вариант 3
 *
 *   **Описание:** <пояснение>
 */
export function parseMarkdownChapter(content: string): ParsedChapter {
  const normalized = content
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");

  const lines = normalized.split("\n");

  // --- Extract chapter title ---
  const titleRegex = /^\s*#{0,3}\s*(?:Глава|Тема)(?:\s|:|$).*$/i;
  console.log("=== mdParser DEBUG ===");
  console.log("titleRegex.source =", titleRegex.source);
  console.log("lines.length =", lines.length);
  console.log("lines[0] =", JSON.stringify(lines[0]));
  console.log("lines[0].trim() =", JSON.stringify((lines[0] ?? "").trim()));
  console.log("regex.test =", titleRegex.test((lines[0] ?? "").trim()));
  const titleLine = lines.find((l) => titleRegex.test(l.trim()));

  if (!titleLine) {
    throw new Error(
      "Файл не содержит заголовка главы. Ожидается строка вида " +
        '"# Глава: Название" или "# Глава 1. Название". ' +
        `Первая строка файла: "${lines[0]?.slice(0, 80) ?? ""}"`
    );
  }

  const title = titleLine
    .replace(/^\s*#{0,3}\s*/, "")
    .replace(/^(?:Глава|Тема)\s*\d*\s*[.:\-–—]?\s*/i, "")
    .trim();

  if (!title) {
    throw new Error("Название главы не может быть пустым.");
  }

  // --- Split into question blocks ---
  const questionRegex = /^##\s+Вопрос(?:\s|:|$)/i;

  const questionBlocks: string[] = [];
  let currentBlock: string[] = [];
  let inQuestion = false;

  for (const line of lines) {
    if (questionRegex.test(line.trim())) {
      if (inQuestion && currentBlock.length > 0) {
        questionBlocks.push(currentBlock.join("\n"));
      }
      currentBlock = [line];
      inQuestion = true;
    } else if (inQuestion) {
      currentBlock.push(line);
    }
  }
  if (inQuestion && currentBlock.length > 0) {
    questionBlocks.push(currentBlock.join("\n"));
  }

  if (questionBlocks.length === 0) {
    throw new Error("Файл не содержит вопросов (## Вопрос ...).");
  }

  const questions: ParsedQuestion[] = questionBlocks.map((block, idx) =>
    parseQuestionBlock(block, idx + 1)
  );

  return { title, questions };
}

function parseQuestionBlock(block: string, qNum: number): ParsedQuestion {
  const lines = block.split("\n");

  // --- 1. Текст вопроса ---
  // Первая строка — маркер "## Вопрос N" (может быть "## Вопрос:" / "## Вопрос 1.")
  const firstLine = lines[0].trim();
  const headerRemainder = firstLine
    .replace(/^##\s+Вопрос\s*:?\s*\d*\.?\s*/i, "")
    .trim();

  let questionText = headerRemainder;
  let contentStartIdx = 1;

  // Если в заголовке только "## Вопрос N" — берём текст из следующей непустой строки
  if (!questionText) {
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) continue;
      // если сразу идёт картинка — текст вопроса ищем ниже (маловероятно, но пусть)
      if (/^!\[.*?\]\(.+?\)$/.test(l)) break;
      questionText = l;
      contentStartIdx = i + 1;
      break;
    }
  }

  // Убираем хвостовой "*" (частая пометка в тестах 1С)
  questionText = questionText.replace(/\s*\*+\s*$/, "").trim();

  if (!questionText) {
    throw new Error(`Вопрос #${qNum}: текст вопроса пустой.`);
  }

  // --- 2. Разбор остальных строк ---
  let imageUrl: string | null = null;
  let description: string | null = null;
  const answers: ParsedAnswer[] = [];

  for (let i = contentStartIdx; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    // Image: ![...](url)
    const imgMatch = trimmed.match(/^!\[.*?\]\((.+?)\)$/);
    if (imgMatch) {
      imageUrl = imgMatch[1];
      continue;
    }

    // Answer: - [ ] text | * [x] text
    const answerMatch = trimmed.match(/^[-*]\s+\[(x| )\]\s+(.+)$/i);
    if (answerMatch) {
      answers.push({
        isCorrect: answerMatch[1].toLowerCase() === "x",
        text: answerMatch[2].trim().replace(/[;*]+\s*$/, "").trim(),
      });
      continue;
    }

    // Description: **Описание:** text
    const descMatch = trimmed.match(/^\*\*Описание:\*\*\s*(.+)$/i);
    if (descMatch) {
      description = descMatch[1].trim();
      continue;
    }
  }

  if (answers.length === 0) {
    throw new Error(`Вопрос #${qNum} «${questionText}»: нет вариантов ответа.`);
  }

  const correctCount = answers.filter((a) => a.isCorrect).length;
  if (correctCount === 0) {
    throw new Error(
      `Вопрос #${qNum} «${questionText}»: не отмечен правильный ответ [x].`
    );
  }
  if (correctCount > 1) {
    throw new Error(
      `Вопрос #${qNum} «${questionText}»: отмечено несколько правильных ответов — допускается только один [x].`
    );
  }

  return { text: questionText, imageUrl, description, answers };
}