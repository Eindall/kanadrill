import { InitSchema1790847081144 } from './1790847081144-InitSchema';
import { LearningSchema1790863719553 } from './1790863719553-LearningSchema';
import { ReviewSession1790865066983 } from './1790865066983-ReviewSession';
import { DailyGoal1790867345952 } from './1790867345952-DailyGoal';
import { AuthSessions1790868949782 } from './1790868949782-AuthSessions';
import { LeaderboardVisibility1790900000000 } from './1790900000000-LeaderboardVisibility';

/** Liste explicite des migrations, dans l'ordre. À compléter à chaque `migration:generate`. */
export const MIGRATIONS = [InitSchema1790847081144, LearningSchema1790863719553, ReviewSession1790865066983, DailyGoal1790867345952, AuthSessions1790868949782, LeaderboardVisibility1790900000000];
