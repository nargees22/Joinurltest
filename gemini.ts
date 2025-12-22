
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import type { Question } from './types.ts';
import { QuestionType } from "./types.ts";

// Fix: Define a type for the questions returned by the AI. This mirrors the schema.
type AiGeneratedQuestion = Omit<Question, 'id' | 'type' | 'matchPairs' | 'correctAnswers' | 'organizerName' | 'creationTime'>;

// Fix: Define a type for the overall JSON response structure.
interface AiResponse {
    questions: AiGeneratedQuestion[];
}

const schema = {
    type: Type.OBJECT,
    properties: {
        questions: {
            type: Type.ARRAY,
            description: 'A list of generated quiz questions.',
            items: {
                type: Type.OBJECT,
                properties: {
                    text: { type: Type.STRING, description: 'The question text.' },
                    options: {
                        type: Type.ARRAY,
                        description: 'An array of exactly 4 possible answers.',
                        items: { type: Type.STRING }
                    },
                    correctAnswerIndex: { type: Type.INTEGER, description: 'The 0-based index of the correct answer in the options array.' },
                    timeLimit: { type: Type.INTEGER, description: 'Time limit in seconds for the question. Default to 30 seconds.' },
                    technology: { type: Type.STRING, description: 'The main topic or technology of the question.' },
                    skill: { type: Type.STRING, description: 'The skill level or sub-topic.' }
                },
                required: ['text', 'options', 'correctAnswerIndex', 'timeLimit', 'technology', 'skill']
            }
        }
    },
    required: ['questions']
};


export async function generateQuestions(topic: string, skill: string, count: number): Promise<Omit<Question, 'id'>[]> {
    // ✅ Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key.
    const ai = new GoogleGenAI({
      apiKey: process.env.API_KEY,
    });

    try {
        const prompt = `Generate ${count} unique, high-quality multiple-choice quiz questions for the topic "${topic}" at a "${skill}" skill level.
Each question must have exactly 4 options, with one clearly correct answer.
The position of the correct option must be randomized across questions (not always option 2 or 3).
The question text must not exceed 20 words, and each option must not exceed 10 words.
The technology tag should be "${topic}" and the skill tag should be "${skill}".
Assign a time limit of 30 seconds for each question.
Ensure the questions are distinct and cover different aspects of the topic.`;
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            // Using gemini-3-pro-preview for complex reasoning tasks like quiz generation
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema
            }
        });

        let rawText = response.text.trim();
        if (rawText.startsWith("```json")) {
          rawText = rawText.slice(7, -3).trim();
        }

        // FIX: Changed 'as unknown' to 'as any' to prevent 'unknown' type issues in consuming components like CreateQuizPage.
        const jsonResult = JSON.parse(rawText) as any;
        
        let questionsList: AiGeneratedQuestion[] = [];

        if (typeof jsonResult === 'object' && jsonResult !== null) {
            if ('questions' in jsonResult && Array.isArray((jsonResult as AiResponse).questions)) {
                questionsList = (jsonResult as AiResponse).questions;
            } else if (Array.isArray(jsonResult)) {
                questionsList = jsonResult as AiGeneratedQuestion[];
            }
        }
        
        if (questionsList.length > 0) {
            // Basic validation to ensure the AI followed instructions
            const validatedQuestions = (questionsList as AiGeneratedQuestion[]).filter((q) => 
                q.text && Array.isArray(q.options) && q.options.length === 4 &&
                typeof q.correctAnswerIndex === 'number' && q.correctAnswerIndex >= 0 && q.correctAnswerIndex < 4
            );
            return validatedQuestions.map((q) => ({ ...q, type: QuestionType.MCQ }));
        }
        return [];
    } catch (error) {
        console.error("Error generating questions:", error);
        throw new Error("Failed to generate questions with AI. Please check your API key and try again.");
    }
}
