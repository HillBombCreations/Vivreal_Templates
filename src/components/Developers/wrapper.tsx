'use client';

import { ArticleData } from '@/types/Articles';
import DevelopersPage from './index';

const DevelopersPageWrapper = (props: ArticleData[]) => {
    return <DevelopersPage { ...props } />;
};

export default DevelopersPageWrapper;