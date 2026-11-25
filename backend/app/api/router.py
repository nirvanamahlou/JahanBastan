"""Application router composition."""

from fastapi import APIRouter

from app.api.routes.account import router as account_router
from app.api.routes.admin_agencies import router as admin_agencies_router
from app.api.routes.admin_audit import router as admin_audit_router
from app.api.routes.admin_carts import router as admin_carts_router
from app.api.routes.admin_customers import router as admin_customers_router
from app.api.routes.admin_data_transfer import router as admin_data_transfer_router
from app.api.routes.admin_dataverse import router as admin_dataverse_router
from app.api.routes.admin_excel import router as admin_excel_router
from app.api.routes.admin_pricing import router as admin_pricing_router
from app.api.routes.admin_users import router as admin_users_router
from app.api.routes.admin_visa_applications import (
    router as admin_visa_applications_router,
)
from app.api.routes.auth import router as auth_router
from app.api.routes.bookings import admin_router as admin_bookings_router
from app.api.routes.bookings import customer_router as customer_bookings_router
from app.api.routes.catalog import router as catalog_router
from app.api.routes.checkout import admin_router as admin_checkout_router
from app.api.routes.checkout import customer_router as customer_checkout_router
from app.api.routes.destination_management import (
    router as destination_management_router,
)
from app.api.routes.editorial_management import router as editorial_management_router
from app.api.routes.erp_catalog import router as erp_catalog_router
from app.api.routes.erp_checkout import router as erp_checkout_router
from app.api.routes.erp_hotels import router as erp_hotels_router
from app.api.routes.erp_visas import router as erp_visas_router
from app.api.routes.health import router as health_router
from app.api.routes.operations import (
    admin_router as admin_operations_router,
)
from app.api.routes.operations import (
    customer_router as customer_operations_router,
)
from app.api.routes.operations import (
    public_router as public_operations_router,
)
from app.api.routes.payments import router as payments_router
from app.api.routes.support import admin_router as admin_support_router
from app.api.routes.support import public_router as public_support_router
from app.api.routes.visa_applications import router as visa_applications_router
from app.core.config import get_settings
from app.integrations.nora.router import router as nora_router

router = APIRouter()
router.include_router(erp_catalog_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(erp_checkout_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(erp_hotels_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(erp_visas_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(nora_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(health_router)
router.include_router(public_operations_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(customer_operations_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(admin_operations_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(payments_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(public_support_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(admin_support_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(account_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(customer_bookings_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(admin_bookings_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(visa_applications_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(auth_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(admin_users_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(admin_pricing_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(admin_carts_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(admin_audit_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(admin_agencies_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(admin_customers_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(
    admin_visa_applications_router, prefix=get_settings().API_V1_PREFIX
)
router.include_router(catalog_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(customer_checkout_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(admin_checkout_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(
    destination_management_router, prefix=get_settings().API_V1_PREFIX
)
router.include_router(editorial_management_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(admin_data_transfer_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(admin_dataverse_router, prefix=get_settings().API_V1_PREFIX)
router.include_router(admin_excel_router, prefix=get_settings().API_V1_PREFIX)
