import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface ProposalCardProps {
  id: string
  name: string
  clientName: string
  status: 'draft' | 'final'
  updatedAt: string
}

export function ProposalCard({ id, name, clientName, status, updatedAt }: ProposalCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{name}</CardTitle>
          <Badge variant={status === 'final' ? 'default' : 'secondary'}>
            {status === 'final' ? 'Final' : 'Borrador'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{clientName}</p>
      </CardHeader>
      <CardFooter className="flex justify-between">
        <span className="text-xs text-muted-foreground">{updatedAt}</span>
        <div className="flex gap-2">
          <Link href={`/proposals/${id}/edit`}>
            <Button size="sm" variant="outline">Editar</Button>
          </Link>
          <Link href={`/proposals/${id}/preview`}>
            <Button size="sm">Ver</Button>
          </Link>
        </div>
      </CardFooter>
    </Card>
  )
}
