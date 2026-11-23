"""Add connector-owned persistence without changing existing business data."""

from alembic import op

revision = "20261107_0103"
down_revision = "20261102_0102"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "\nCREATE TABLE nora_installation (\n\tid SERIAL NOT NULL, \n\torganization_id VARCHAR(36) NOT NULL, \n\ttracking_started_at TIMESTAMP WITH TIME ZONE, \n\tPRIMARY KEY (id), \n\tUNIQUE (organization_id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE nora_page_views (\n\tevent_hash VARCHAR(64) NOT NULL, \n\tbrowser_hash VARCHAR(64) NOT NULL, \n\tcategory VARCHAR(30) NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (event_hash)\n)\n\n"
    )
    op.execute(
        "CREATE INDEX ix_nora_page_views_created_at ON nora_page_views (created_at)"
    )
    op.execute(
        "\nCREATE TABLE nora_presence (\n\tbrowser_hash VARCHAR(64) NOT NULL, \n\tcategory VARCHAR(30) NOT NULL, \n\tseen_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (browser_hash)\n)\n\n"
    )
    op.execute("CREATE INDEX ix_nora_presence_seen_at ON nora_presence (seen_at)")
    op.execute(
        "\nCREATE TABLE nora_connections (\n\tid VARCHAR(32) NOT NULL, \n\tsite_id VARCHAR(40) NOT NULL, \n\torganization_id VARCHAR(36) NOT NULL, \n\tenvironment VARCHAR(20) NOT NULL, \n\tnora_origin VARCHAR(2048) NOT NULL, \n\tkey_hash VARCHAR(64) NOT NULL, \n\tsigning_ciphertext TEXT NOT NULL, \n\tresources JSONB NOT NULL, \n\tissuer_id BIGINT NOT NULL, \n\texpires_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\trenewed_at TIMESTAMP WITH TIME ZONE, \n\trevoked_at TIMESTAMP WITH TIME ZONE, \n\tdeleted_at TIMESTAMP WITH TIME ZONE, \n\tversion INTEGER NOT NULL, \n\trate_minute INTEGER NOT NULL, \n\trate_count INTEGER NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(issuer_id) REFERENCES admin_users (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE nora_actors (\n\tconnection_id VARCHAR(32) NOT NULL, \n\tbranch_id VARCHAR(36) NOT NULL, \n\tsubject VARCHAR(36) NOT NULL, \n\tadmin_id BIGINT NOT NULL, \n\tPRIMARY KEY (connection_id, branch_id, subject), \n\tFOREIGN KEY(connection_id) REFERENCES nora_connections (id), \n\tUNIQUE (admin_id), \n\tFOREIGN KEY(admin_id) REFERENCES admin_users (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE nora_audit (\n\tid VARCHAR(32) NOT NULL, \n\tconnection_id VARCHAR(32) NOT NULL, \n\tactor VARCHAR(120) NOT NULL, \n\taction VARCHAR(80) NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(connection_id) REFERENCES nora_connections (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE nora_nonces (\n\tconnection_id VARCHAR(32) NOT NULL, \n\trequest_id VARCHAR(32) NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (connection_id, request_id), \n\tFOREIGN KEY(connection_id) REFERENCES nora_connections (id)\n)\n\n"
    )
    op.execute("CREATE INDEX ix_nora_nonces_created_at ON nora_nonces (created_at)")
    op.execute(
        "\nCREATE TABLE nora_operations (\n\tconnection_id VARCHAR(32) NOT NULL, \n\toperation_id VARCHAR(120) NOT NULL, \n\tfingerprint VARCHAR(64) NOT NULL, \n\tresult JSONB NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (connection_id, operation_id), \n\tFOREIGN KEY(connection_id) REFERENCES nora_connections (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE nora_previews (\n\tid VARCHAR(32) NOT NULL, \n\tconnection_id VARCHAR(32) NOT NULL, \n\tbranch_id VARCHAR(36) NOT NULL, \n\tsubject VARCHAR(36) NOT NULL, \n\tkind VARCHAR(20) NOT NULL, \n\tsource_revision VARCHAR(64) NOT NULL, \n\tciphertext TEXT NOT NULL, \n\texpires_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(connection_id) REFERENCES nora_connections (id)\n)\n\n"
    )


def downgrade() -> None:
    op.drop_table("nora_previews")
    op.drop_table("nora_operations")
    op.drop_table("nora_nonces")
    op.drop_table("nora_audit")
    op.drop_table("nora_actors")
    op.drop_table("nora_connections")
    op.drop_table("nora_presence")
    op.drop_table("nora_page_views")
    op.drop_table("nora_installation")
