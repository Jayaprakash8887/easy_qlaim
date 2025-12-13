import { useNavigate } from 'react-router-dom';
import { ClaimSubmissionForm } from '@/components/claims/ClaimSubmissionForm';

export default function NewClaim() {
  const navigate = useNavigate();

  return <ClaimSubmissionForm onClose={() => navigate('/claims')} />;
}
