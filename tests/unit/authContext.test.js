import React from "react";
import { render } from "@testing-library/react";
import { AuthProvider, useAuth } from "../../src/contexts/AuthContext";

function Dummy() {
  const { isAuthenticated } = useAuth();
  return <div>auth:{isAuthenticated ? "yes" : "no"}</div>;
}

test("AuthProvider renders", () => {
  const { getByText } = render(
    <AuthProvider>
      <Dummy />
    </AuthProvider>
  );
  expect(getByText(/auth:/)).toBeInTheDocument();
});
