// apps/frontend/src/pages/onboarding/flows/index.ts
import VendorFlow from "./VendorFlow";
import BusinessAssociationFlow from "./BusinessAssociationFlow";
import EmployeeFlow from "./EmployeeFlow";

type Props = {
  canon: "Vendor" | "BusinessAssociation" | "Employee";
  token: string;
  meta: any;
};

export default function PublicOnboardingRouter({ canon, token, meta }: Props) {
  if (canon === "Vendor") {
    return <VendorFlow token={token} meta={meta} />;
  }

  if (canon === "BusinessAssociation") {
    return <BusinessAssociationFlow token={token} meta={meta} />;
  }

  return <EmployeeFlow token={token} meta={meta} />;
}
