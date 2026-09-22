"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileUpdateSchema, type ProfileUpdateInput } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import type { Board, Class, Profile } from "@/types";
import { getFallbackBoards, getFallbackClassesForBoard } from "@/lib/board-data";

type Props = {
  initial?: Partial<Profile>;
};

export default function ProfileForm({ initial }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [boards, setBoards] = useState<Board[]>(getFallbackBoards() as Board[]);
  const [classes, setClasses] = useState<Class[]>([]);

  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      full_name: initial?.full_name || "",
      phone: initial?.phone || "",
      date_of_birth: initial?.date_of_birth || "",
      gender: (initial?.gender as ProfileUpdateInput["gender"]) || undefined,
      bio: initial?.bio || "",
      board_id: initial?.board_id || undefined,
      class_id: initial?.class_id || undefined,
      daily_goal_minutes: initial?.daily_goal_minutes || 60,
    },
  });

  const selectedBoardId = useWatch({ control, name: "board_id" });

  useEffect(() => {
    fetch("/api/boards")
      .then((response) => response.json())
      .then((result) => {
        if (result?.success && Array.isArray(result.data) && result.data.length > 0) setBoards(result.data as Board[]);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedBoardId) {
      setClasses([]);
      setValue("class_id", undefined);
      return;
    }
    setClasses(getFallbackClassesForBoard(selectedBoardId) as Class[]);
    fetch(`/api/classes?boardId=${encodeURIComponent(selectedBoardId)}`)
      .then((response) => response.json())
      .then((result) => {
        if (result?.success && Array.isArray(result.data) && result.data.length > 0) setClasses(result.data as Class[]);
      })
      .catch(() => undefined);
  }, [selectedBoardId, setValue]);

  async function onSubmit(values: ProfileUpdateInput) {
    setLoading(true);
    try {
      const res = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        toast({ title: 'Save failed', description: body.error || 'Unable to save profile', variant: 'destructive' });
        return;
      }
      toast({ title: 'Profile saved', description: 'Your profile has been updated.' });
      router.refresh();
    } catch {
      toast({ title: 'Save failed', description: 'Unable to save profile', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" {...register('full_name')} />
          {errors.full_name && <p className="text-sm text-destructive">{errors.full_name.message}</p>}
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" {...register('phone')} />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
        </div>
        <div>
          <Label htmlFor="date_of_birth">Date of birth</Label>
          <Input id="date_of_birth" type="date" {...register('date_of_birth')} />
          {errors.date_of_birth && <p className="text-sm text-destructive">{errors.date_of_birth.message}</p>}
        </div>
        <div>
          <Label htmlFor="gender">Gender</Label>
          <select id="gender" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('gender')}>
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="non_binary">Non-binary</option>
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="bio">Bio</Label>
        <textarea id="bio" rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('bio')}></textarea>
        {errors.bio && <p className="text-sm text-destructive">{errors.bio.message}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="board_id">Board</Label>
          <select id="board_id" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('board_id', { onChange: () => setValue("class_id", undefined) })}>
            <option value="">Select board</option>
            {boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}
          </select>
          {errors.board_id && <p className="text-sm text-destructive">{errors.board_id.message}</p>}
        </div>
        <div>
          <Label htmlFor="class_id">Class</Label>
          <select id="class_id" disabled={!selectedBoardId} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50" {...register('class_id')}>
            <option value="">Select class</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {errors.class_id && <p className="text-sm text-destructive">{errors.class_id.message}</p>}
        </div>
        <div>
          <Label htmlFor="daily_goal_minutes">Daily goal (minutes)</Label>
          <Input id="daily_goal_minutes" type="number" {...register('daily_goal_minutes', { valueAsNumber: true })} />
          {errors.daily_goal_minutes && <p className="text-sm text-destructive">{errors.daily_goal_minutes.message}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save profile'}</Button>
      </div>
    </form>
  );
}
