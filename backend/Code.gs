function doGet(e) {
  return getResponses();
}

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Réponses');
    const data = JSON.parse(e.postData.contents);
    
    sheet.appendRow([
      new Date(),
      data.connaissanceQuasquara,
      data.positionQuasquara,
      data.quiDecide,
      data.satisfactionDemocratie,
      Number(data.declinCorte), // Nouveau champ ajouté
      data.favorableReferendum,
      data.sujetsReferendum.join(', '),
      data.quartier,
      data.age,
      data.dureeHabitation,
      data.email,
      data.accepteContact,
      data.commentaire
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({success: true}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getResponses() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  const formattedData = rows.map(row => {
    const obj = {};
    headers.forEach((header, i) => obj[header] = row[i]);
    return obj;
  });
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    data: formattedData
  })).setMimeType(ContentService.MimeType.JSON);
}
