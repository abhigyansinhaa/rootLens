import React, { useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../../lib/utils'

export interface AnimatedListProps {
  className?: string
  children: React.ReactNode
  delay?: number
}

export const AnimatedList = React.memo(({ className, children, delay = 1000 }: AnimatedListProps) => {
  const [index, setIndex] = useState(0)
  const childrenArray = React.Children.toArray(children)

  useEffect(() => {
    if (index < childrenArray.length - 1) {
      const timeout = setTimeout(() => {
        setIndex((prevIndex) => prevIndex + 1)
      }, delay)

      return () => clearTimeout(timeout)
    }
  }, [index, delay, childrenArray.length])

  const itemsToShow = useMemo(() => {
    const result = childrenArray.slice(0, index + 1).reverse()
    return result
  }, [index, childrenArray])

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <AnimatePresence>
        {itemsToShow.map((item) => (
          <AnimatedListItem key={(item as ReactElement).key}>
            {item}
          </AnimatedListItem>
        ))}
      </AnimatePresence>
    </div>
  )
})

AnimatedList.displayName = 'AnimatedList'

export function AnimatedListItem({ children }: { children: React.ReactNode }) {
  const animations = {
    initial: { scale: 0.95, opacity: 0, y: 10 },
    animate: { scale: 1, opacity: 1, y: 0, originY: 0 },
    exit: { scale: 0.95, opacity: 0, y: -10 },
    transition: { type: 'spring' as const, stiffness: 200, damping: 25 },
  }

  return (
    <motion.div {...animations} layout className="mx-auto w-full">
      {children}
    </motion.div>
  )
}
