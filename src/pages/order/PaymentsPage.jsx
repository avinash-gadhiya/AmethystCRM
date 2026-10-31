import { PaymentsTable } from './table/PaymentsTable';
import { PageWrapper } from '@/components/common/page-card';

const PaymentsPage = () => {
  return (
    <PageWrapper className="payments-page-wrapper">
      <PaymentsTable />
    </PageWrapper>
  );
};

export { PaymentsPage };


