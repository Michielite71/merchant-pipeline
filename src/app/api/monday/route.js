import { NextResponse } from "next/server";

const API_TOKEN = process.env.MONDAY_API_TOKEN;

export async function POST(request) {
  const body = await request.json();

  const response = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: API_TOKEN,
      "API-Version": "2024-10",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return NextResponse.json(data);
}
