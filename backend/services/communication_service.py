"""
Communication Service for sending notifications to Slack/Teams

Handles sending notifications to external communication platforms when:
- Claims are submitted
- Claims are approved
- Claims are rejected
- Claims are settled
"""
import httpx
import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import and_

from models import IntegrationCommunication

logger = logging.getLogger(__name__)


class CommunicationService:
    """Service for sending notifications to Slack and Teams"""
    
    def __init__(self, db: Session, tenant_id: UUID):
        self.db = db
        self.tenant_id = tenant_id
        self._configs_cache = None
    
    def _get_configs(self):
        """Get active communication configurations for the tenant"""
        if self._configs_cache is None:
            self._configs_cache = self.db.query(IntegrationCommunication).filter(
                and_(
                    IntegrationCommunication.tenant_id == self.tenant_id,
                    IntegrationCommunication.is_active == True
                )
            ).all()
        return self._configs_cache
    
    async def send_claim_notification(
        self,
        event_type: str,  # 'submitted', 'approved', 'rejected', 'settled'
        claim_number: str,
        employee_name: str,
        amount: float,
        currency: str = "INR",
        approver_name: Optional[str] = None,
        reason: Optional[str] = None,
        claim_url: Optional[str] = None
    ) -> dict:
        """
        Send notification to all configured communication channels.
        
        Returns dict with status for each provider.
        """
        results = {}
        configs = self._get_configs()
        
        for config in configs:
            # Check if this event type should trigger notification
            should_notify = False
            if event_type == 'submitted' and config.notify_on_claim_submitted:
                should_notify = True
            elif event_type == 'approved' and config.notify_on_claim_approved:
                should_notify = True
            elif event_type == 'rejected' and config.notify_on_claim_rejected:
                should_notify = True
            elif event_type == 'settled' and config.notify_on_claim_settled:
                should_notify = True
            
            if not should_notify:
                results[config.provider] = {"sent": False, "reason": "Notification disabled for this event"}
                continue
            
            try:
                if config.provider == 'slack':
                    success = await self._send_slack_notification(
                        config, event_type, claim_number, employee_name, 
                        amount, currency, approver_name, reason, claim_url
                    )
                    results['slack'] = {"sent": success}
                elif config.provider == 'microsoft_teams':
                    success = await self._send_teams_notification(
                        config, event_type, claim_number, employee_name,
                        amount, currency, approver_name, reason, claim_url
                    )
                    results['microsoft_teams'] = {"sent": success}
            except Exception as e:
                logger.error(f"Failed to send {config.provider} notification: {str(e)}")
                results[config.provider] = {"sent": False, "error": str(e)}
        
        return results
    
    async def _send_slack_notification(
        self, config, event_type, claim_number, employee_name,
        amount, currency, approver_name, reason, claim_url
    ) -> bool:
        """Send notification to Slack"""
        if not config.slack_bot_token or not config.slack_channel_id:
            logger.warning("Slack bot token or channel ID not configured")
            return False
        
        # Build message based on event type
        message = self._build_notification_message(
            event_type, claim_number, employee_name, amount, currency, approver_name, reason
        )
        
        emoji_map = {
            'submitted': '📋',
            'approved': '✅',
            'rejected': '❌',
            'settled': '💰'
        }
        emoji = emoji_map.get(event_type, '📢')
        
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{emoji} Claim {event_type.title()}",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Claim Number:*\n{claim_number}"},
                    {"type": "mrkdwn", "text": f"*Employee:*\n{employee_name}"},
                    {"type": "mrkdwn", "text": f"*Amount:*\n{currency} {amount:,.2f}"},
                    {"type": "mrkdwn", "text": f"*Time:*\n{datetime.now().strftime('%Y-%m-%d %H:%M')}"}
                ]
            }
        ]
        
        if approver_name:
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*By:* {approver_name}"}
            })
        
        if reason:
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Reason:* {reason}"}
            })
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://slack.com/api/chat.postMessage",
                    headers={"Authorization": f"Bearer {config.slack_bot_token}"},
                    json={
                        "channel": config.slack_channel_id,
                        "text": message,
                        "blocks": blocks
                    }
                )
                result = response.json()
                if result.get("ok"):
                    logger.info(f"Slack notification sent for claim {claim_number}")
                    return True
                else:
                    logger.error(f"Slack API error: {result.get('error')}")
                    return False
        except Exception as e:
            logger.error(f"Failed to send Slack notification: {str(e)}")
            return False
    
    async def _send_teams_notification(
        self, config, event_type, claim_number, employee_name,
        amount, currency, approver_name, reason, claim_url
    ) -> bool:
        """Send notification to Microsoft Teams"""
        if not config.teams_webhook_url:
            logger.warning("Teams webhook URL not configured")
            return False
        
        webhook_url = config.teams_webhook_url
        
        # Detect if it's a Power Automate URL
        is_power_automate = "powerautomate" in webhook_url.lower() or "flow.microsoft" in webhook_url.lower()
        
        # Color and emoji based on event type
        color_map = {
            'submitted': '0078D4',  # Blue
            'approved': '28A745',   # Green
            'rejected': 'DC3545',   # Red
            'settled': '6F42C1'     # Purple
        }
        emoji_map = {
            'submitted': '📋',
            'approved': '✅',
            'rejected': '❌',
            'settled': '💰'
        }
        
        theme_color = color_map.get(event_type, '0078D4')
        emoji = emoji_map.get(event_type, '📢')
        title = f"{emoji} Claim {event_type.title()}"
        
        # Build facts
        facts = [
            {"title": "Claim Number", "value": claim_number},
            {"title": "Employee", "value": employee_name},
            {"title": "Amount", "value": f"{currency} {amount:,.2f}"},
            {"title": "Time", "value": datetime.now().strftime('%Y-%m-%d %H:%M')}
        ]
        
        if approver_name:
            facts.append({"title": "By", "value": approver_name})
        
        if reason:
            facts.append({"title": "Reason", "value": reason})
        
        try:
            async with httpx.AsyncClient() as client:
                if is_power_automate:
                    # Power Automate expects Adaptive Card format
                    payload = {
                        "type": "message",
                        "attachments": [
                            {
                                "contentType": "application/vnd.microsoft.card.adaptive",
                                "content": {
                                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                                    "type": "AdaptiveCard",
                                    "version": "1.4",
                                    "body": [
                                        {
                                            "type": "TextBlock",
                                            "size": "Medium",
                                            "weight": "Bolder",
                                            "text": title,
                                            "wrap": True,
                                            "color": "attention" if event_type == 'rejected' else "good" if event_type in ('approved', 'settled') else "default"
                                        },
                                        {
                                            "type": "FactSet",
                                            "facts": [{"title": f["title"], "value": f["value"]} for f in facts]
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                else:
                    # Standard Teams Incoming Webhook uses MessageCard format
                    payload = {
                        "@type": "MessageCard",
                        "@context": "http://schema.org/extensions",
                        "summary": f"Claim {event_type.title()}: {claim_number}",
                        "themeColor": theme_color,
                        "title": title,
                        "sections": [
                            {
                                "activityTitle": f"Expense Claim {event_type.title()}",
                                "facts": [{"name": f["title"], "value": f["value"]} for f in facts],
                                "markdown": True
                            }
                        ]
                    }
                
                response = await client.post(webhook_url, json=payload)
                
                if response.status_code in (200, 202):
                    logger.info(f"Teams notification sent for claim {claim_number}")
                    return True
                else:
                    logger.error(f"Teams webhook error: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to send Teams notification: {str(e)}")
            return False
    
    def _build_notification_message(
        self, event_type, claim_number, employee_name, amount, currency, approver_name, reason
    ) -> str:
        """Build a plain text notification message"""
        messages = {
            'submitted': f"New expense claim {claim_number} submitted by {employee_name} for {currency} {amount:,.2f}",
            'approved': f"Expense claim {claim_number} for {currency} {amount:,.2f} has been approved" + (f" by {approver_name}" if approver_name else ""),
            'rejected': f"Expense claim {claim_number} for {currency} {amount:,.2f} has been rejected" + (f" by {approver_name}" if approver_name else "") + (f". Reason: {reason}" if reason else ""),
            'settled': f"Expense claim {claim_number} for {currency} {amount:,.2f} has been settled and payment processed"
        }
        return messages.get(event_type, f"Claim {claim_number} status updated to {event_type}")


# Helper function to send notifications (can be called from anywhere)
async def send_claim_notification(
    db: Session,
    tenant_id: UUID,
    event_type: str,
    claim_number: str,
    employee_name: str,
    amount: float,
    currency: str = "INR",
    approver_name: Optional[str] = None,
    reason: Optional[str] = None,
    claim_url: Optional[str] = None
) -> dict:
    """
    Helper function to send claim notifications to all configured channels.
    """
    logger.info(f"[COMMUNICATION] send_claim_notification called: tenant_id={tenant_id}, event_type={event_type}, claim={claim_number}")
    
    try:
        service = CommunicationService(db, tenant_id)
        configs = service._get_configs()
        logger.info(f"[COMMUNICATION] Found {len(configs)} active communication configs for tenant {tenant_id}")
        for cfg in configs:
            logger.info(f"[COMMUNICATION] Config: provider={cfg.provider}, is_active={cfg.is_active}, teams_url={'set' if cfg.teams_webhook_url else 'not set'}")
        
        result = await service.send_claim_notification(
            event_type=event_type,
            claim_number=claim_number,
            employee_name=employee_name,
            amount=amount,
            currency=currency,
            approver_name=approver_name,
            reason=reason,
            claim_url=claim_url
        )
        logger.info(f"[COMMUNICATION] Notification result: {result}")
        return result
    except Exception as e:
        logger.error(f"[COMMUNICATION] Error in send_claim_notification: {str(e)}", exc_info=True)
        raise
