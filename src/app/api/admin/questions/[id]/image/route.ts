import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { questions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAdminAuthenticated } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await isAdminAuthenticated();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const qId = parseInt(id, 10);

  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const allowedExts = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
    if (!allowedExts.includes(ext)) {
      return NextResponse.json(
        { error: "Недопустимый тип файла" },
        { status: 400 }
      );
    }

    const filename = `q${qId}_${Date.now()}.${ext}`;
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(path.join(uploadsDir, filename), buffer);

    const imageUrl = `/uploads/${filename}`;

    await db
      .update(questions)
      .set({ imageUrl, updatedAt: new Date() })
      .where(eq(questions.id, qId));

    return NextResponse.json({ ok: true, imageUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ошибка загрузки";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
