'use client'
import dynamic from 'next/dynamic'
import { CardSkeleton } from '@/components/ui'

// Recharts is large, so the charts load in their own chunk after the page shell is visible.
const DashboardCharts = dynamic(() => import('./DashboardCharts'), {
  ssr: false,
  loading: () => (
    <div className="grid gap-6 lg:grid-cols-2">
      <CardSkeleton rows={6} />
      <CardSkeleton rows={6} />
    </div>
  ),
})

export default DashboardCharts
