import React, { useState } from "react";
import CrudDashboard from "./crud-dashboard/CrudDashboard";
import UIAssistantModal from "./chatbot";

export default function App() {
  return (
    <>
      <CrudDashboard />
      <UIAssistantModal />
    </>
  );
}
