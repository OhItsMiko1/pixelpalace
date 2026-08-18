import type { Alignment } from '../data/characters';
import { QUEST_SPECS, type Quest, type QuestStep, type QuestStepType } from '../data/quests';
import type { Phase } from './DayNightCycle';

export interface QuestProgress {
  completedQuestIds: string[];
  activeIndex: number;
  stepIndex: number;
}

export interface QuestNotifyResult {
  stepAdvanced: boolean;
  questCompleted?: Quest;
}

export class QuestSystem {
  private readonly quests: Quest[];
  private completed: Set<string>;
  private activeIndex: number;
  private stepIndex: number;

  constructor(alignment: Alignment, progress?: QuestProgress) {
    this.quests = QUEST_SPECS.filter((q) => q.alignment === alignment);
    this.completed = new Set(progress?.completedQuestIds ?? []);
    this.activeIndex = Math.min(progress?.activeIndex ?? 0, this.quests.length);
    this.stepIndex = progress?.stepIndex ?? 0;
  }

  getAllQuests(): Quest[] {
    return this.quests;
  }

  isCompleted(id: string): boolean {
    return this.completed.has(id);
  }

  getActiveQuest(): Quest | null {
    return this.quests[this.activeIndex] ?? null;
  }

  getActiveStep(): QuestStep | null {
    const quest = this.getActiveQuest();
    return quest ? quest.steps[this.stepIndex] ?? null : null;
  }

  serialize(): QuestProgress {
    return {
      completedQuestIds: [...this.completed],
      activeIndex: this.activeIndex,
      stepIndex: this.stepIndex,
    };
  }

  /**
   * Call on every talk/visit interaction. Only the current step of the
   * current quest can ever match — earlier or later steps are ignored, so
   * interacting with a future-quest NPC early does nothing until it's live.
   */
  notify(type: QuestStepType, targetId: string, phase: Phase): QuestNotifyResult {
    const step = this.getActiveStep();
    if (!step || step.type !== type || step.targetId !== targetId) return { stepAdvanced: false };
    if (step.requiresPhase && step.requiresPhase !== phase) return { stepAdvanced: false };

    const quest = this.getActiveQuest()!;
    this.stepIndex++;
    if (this.stepIndex >= quest.steps.length) {
      this.completed.add(quest.id);
      this.activeIndex++;
      this.stepIndex = 0;
      return { stepAdvanced: true, questCompleted: quest };
    }
    return { stepAdvanced: true };
  }
}
