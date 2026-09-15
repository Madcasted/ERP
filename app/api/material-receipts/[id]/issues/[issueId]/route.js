import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(request, { params }) {
  const issue = await prisma.materialIssue.findFirst({ where: { id: params.issueId, receiptId: params.id } });
  if (!issue) return NextResponse.json({ error: "issue not found" }, { status: 404 });

  await prisma.materialIssue.delete({ where: { id: issue.id } });
  return NextResponse.json({ success: true });
}