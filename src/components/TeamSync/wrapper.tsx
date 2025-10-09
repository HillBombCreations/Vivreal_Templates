'use client';

import TeamSync from './index';
import { TeamSyncDataProps } from '@/types/LandingPage/TeamSync';

const TeamSyncWrapper = (props: TeamSyncDataProps) => {
    return <TeamSync { ...props } />;
};

export default TeamSyncWrapper;