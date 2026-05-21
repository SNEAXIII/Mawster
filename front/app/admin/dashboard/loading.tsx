import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import TableHeaderUsers from '@/components/dashboard/table/table-header';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface LoadingProps {
  usersPerPage: number;
}

export default function Loading({ usersPerPage }: LoadingProps) {
  return (
    <div className='container mx-auto py-6'>
      <Table>
        {/*
        // @ts-expect-error useless warning for placeholder*/}
        <TableHeaderUsers />
        <TableBody>
          {Array.from({ length: usersPerPage }, (_, index) => (
            <TableRow key={index}>
              {Array.from({ length: 6 }, (_, key) => (
                <TableCell key={key}>
                  <Skeleton className='h-4 w-full rounded-full' />
                </TableCell>
              ))}
              <TableCell>
                <Button
                  variant='ghost'
                  className='size-8 p-0'
                  disabled={true}
                >
                  <MoreHorizontal className='size-4' />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
