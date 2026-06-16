import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    const body = await request.json();
    const { systemInstruction, contents, generationConfig } = body;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest",
      systemInstruction: systemInstruction,
      generationConfig: generationConfig,
    });

    const result = await model.generateContent({ contents });

    const text = result.response.text();
    return NextResponse.json({ result: text });

  } catch (error) {
    console.error("Gemini API 오류:", error);
    return NextResponse.json(
      { error: "오류가 발생했습니다." },
      { status: 500 }
    );
  }
}